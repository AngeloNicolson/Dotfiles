local M = {}

M.config = {
  deck_dir = "~/knowledge_vault/Study-Vault/Anki",
  data_file = "~/.local/share/nvim/flashcards_progress.json",
  -- AI assistant config
  ollama_url = "http://localhost:11434",
  ollama_model = "llama3.2",
}

M.state = {
  current_deck = nil,
  cards = {},
  current_index = 0,
  showing_answer = false,
  progress = {},
  deck_stats = {},  -- tracks deck session stats
  session_started = false,  -- track if current session was started
  initial_due_count = 0,  -- cards due when session started
  buf = nil,
  win = nil,
  -- Drill mode state (round-based)
  drill_mode = false,
  drill_round = {},     -- cards in current round
  drill_missed = {},    -- cards missed this round (becomes next round)
  drill_streak = {},    -- tracks consecutive correct answers per card
  drill_target = 2,     -- need 2 correct in a row to master
  drill_round_num = 1,  -- current round number
  -- AI assistant state
  ai_buf = nil,
  ai_win = nil,
  ai_input_buf = nil,
  ai_input_win = nil,
}

-- Forward declarations
local close_float

-- Expand path
local function expand_path(path)
  return vim.fn.expand(path)
end

-- Load progress data
local function load_progress()
  local path = expand_path(M.config.data_file)
  local file = io.open(path, "r")
  if file then
    local content = file:read("*all")
    file:close()
    local ok, data = pcall(vim.json.decode, content)
    if ok and data then
      M.state.progress = data.cards or data  -- backwards compat
      M.state.deck_stats = data.deck_stats or {}
    end
  end
end

-- Save progress data
local function save_progress()
  local path = expand_path(M.config.data_file)
  local dir = vim.fn.fnamemodify(path, ":h")
  vim.fn.mkdir(dir, "p")
  local file = io.open(path, "w")
  if file then
    local data = {
      cards = M.state.progress,
      deck_stats = M.state.deck_stats,
    }
    file:write(vim.json.encode(data))
    file:close()
  end
end

-- Get or create deck stats
local function get_deck_stats(deck_id)
  if not M.state.deck_stats[deck_id] then
    M.state.deck_stats[deck_id] = {
      completed = 0,
      abandoned = 0,
      last_completed = nil,
      last_session = nil,
    }
  end
  return M.state.deck_stats[deck_id]
end

-- Record session start
local function start_session(deck_id)
  M.state.session_started = true
  local stats = get_deck_stats(deck_id)
  stats.last_session = os.time()
  save_progress()
end

-- Record completed session
local function complete_session(deck_id)
  if not M.state.session_started then return end
  M.state.session_started = false
  local stats = get_deck_stats(deck_id)
  stats.completed = stats.completed + 1
  stats.last_completed = os.time()
  save_progress()
end

-- Record abandoned session
local function abandon_session(deck_id)
  if not M.state.session_started then return end
  M.state.session_started = false
  local stats = get_deck_stats(deck_id)
  stats.abandoned = stats.abandoned + 1
  save_progress()
end

-- Format time ago
local function time_ago(timestamp)
  if not timestamp then return "never" end
  local diff = os.time() - timestamp
  if diff < 60 then return "just now" end
  if diff < 3600 then return math.floor(diff / 60) .. "m ago" end
  if diff < 86400 then return math.floor(diff / 3600) .. "h ago" end
  if diff < 604800 then return math.floor(diff / 86400) .. "d ago" end
  return os.date("%b %d", timestamp)
end

-- Calculate completion rate and recommendation
local function get_deck_recommendation(stats)
  local total = stats.completed + stats.abandoned
  if total == 0 then return "new", "Start your first session" end

  local rate = stats.completed / total
  if rate >= 0.8 then
    return "good", "Keep it up!"
  elseif rate >= 0.5 then
    return "review", "Consider reviewing"
  else
    return "needs_work", "Needs more practice"
  end
end

-- Close AI assistant windows and return focus to flashcard
local function close_ai_window()
  if M.state.ai_win and vim.api.nvim_win_is_valid(M.state.ai_win) then
    vim.api.nvim_win_close(M.state.ai_win, true)
  end
  if M.state.ai_input_win and vim.api.nvim_win_is_valid(M.state.ai_input_win) then
    vim.api.nvim_win_close(M.state.ai_input_win, true)
  end
  M.state.ai_win = nil
  M.state.ai_buf = nil
  M.state.ai_input_win = nil
  M.state.ai_input_buf = nil
  -- Return focus to flashcard window
  if M.state.win and vim.api.nvim_win_is_valid(M.state.win) then
    vim.api.nvim_set_current_win(M.state.win)
  end
end

-- Get current card context for AI
local function get_current_card_context()
  if M.state.current_index == 0 or #M.state.cards == 0 then
    return nil
  end
  local card = M.state.cards[M.state.current_index]
  if not card then return nil end
  return {
    question = card.q,
    answer = card.a,
    deck = M.state.current_deck,
  }
end

-- Get currently loaded model from ollama ps
local function get_loaded_model(callback)
  vim.fn.jobstart("ollama ps 2>/dev/null | tail -n +2 | head -n 1 | awk '{print $1}'", {
    stdout_buffered = true,
    on_stdout = function(_, data)
      local model = data and data[1] and data[1]:gsub("%s+", "") or ""
      callback(model ~= "" and model or nil)
    end,
  })
end

-- Get list of available models
local function get_available_models(callback)
  vim.fn.jobstart("ollama list 2>/dev/null | tail -n +2 | awk '{print $1}'", {
    stdout_buffered = true,
    on_stdout = function(_, data)
      local models = {}
      for _, line in ipairs(data or {}) do
        local model = line:gsub("%s+", "")
        if model ~= "" then
          table.insert(models, model)
        end
      end
      callback(models)
    end,
  })
end

-- Load a model by sending a minimal request
local function load_model(model, callback)
  vim.notify("Loading " .. model .. "...", vim.log.levels.INFO)
  local payload = vim.json.encode({
    model = model,
    prompt = "hi",
    stream = false,
  })
  local cmd = string.format(
    "curl -s -X POST %s/api/generate -H 'Content-Type: application/json' -d %s",
    M.config.ollama_url,
    vim.fn.shellescape(payload)
  )
  vim.fn.jobstart(cmd, {
    on_exit = function()
      vim.schedule(function()
        vim.notify(model .. " ready", vim.log.levels.INFO)
        callback(model)
      end)
    end,
  })
end

-- Prompt user to select a model
local function select_model(callback)
  get_available_models(function(models)
    if #models == 0 then
      vim.schedule(function()
        vim.notify("No models installed. Run 'ollama pull <model>' first.", vim.log.levels.ERROR)
      end)
      callback(nil)
      return
    end

    vim.schedule(function()
      vim.ui.select(models, {
        prompt = "Select AI model:",
        format_item = function(item) return item end,
      }, function(choice)
        if not choice then
          callback(nil)
          return
        end
        load_model(choice, callback)
      end)
    end)
  end)
end

-- Ensure Ollama is running and a model is loaded
local function ensure_ollama_ready(callback)
  vim.fn.jobstart("systemctl is-active --quiet ollama", {
    on_exit = function(_, exit_code)
      vim.schedule(function()
        if exit_code ~= 0 then
          -- Not running, start it
          vim.notify("Starting Ollama...", vim.log.levels.INFO)
          vim.fn.jobstart("monolith start", {
            on_exit = function()
              vim.schedule(function()
                vim.defer_fn(function()
                  select_model(callback)
                end, 1500)
              end)
            end,
          })
        else
          -- Running, check for loaded model
          get_loaded_model(function(model)
            if model then
              callback(model)
            else
              select_model(callback)
            end
          end)
        end
      end)
    end,
  })
end

-- Query Ollama with card context
local function query_ollama(user_question, callback)
  local card_ctx = get_current_card_context()
  if not card_ctx then
    callback("No card is currently active.")
    return
  end

  ensure_ollama_ready(function(model)
    if not model then
      callback("No model loaded. Run 'monolith' in terminal to select one.")
      return
    end

    local system_prompt = string.format([[You are a helpful study assistant. The user is studying flashcards and needs help understanding the current card.

Current flashcard:
- Question: %s
- Answer: %s
- Deck: %s

Keep your responses concise and focused on helping the user understand this specific card. Explain concepts, provide mnemonics, give examples, or clarify anything about this card.

IMPORTANT: Output plain text only. Do NOT use markdown formatting like **bold**, *italic*, headers (#), or bullet points (-/*). Just use plain sentences and paragraphs.]], card_ctx.question, card_ctx.answer, card_ctx.deck)

    local payload = vim.json.encode({
      model = model,
      prompt = user_question,
      system = system_prompt,
      stream = false,
    })

    local cmd = string.format(
      "curl -s -X POST %s/api/generate -H 'Content-Type: application/json' -d %s",
      M.config.ollama_url,
      vim.fn.shellescape(payload)
    )

    vim.fn.jobstart(cmd, {
      stdout_buffered = true,
      stderr_buffered = true,
      on_stdout = function(_, data)
        local raw = table.concat(data, "")
        if raw == "" then
          callback("Error: Empty response from Ollama. Is the model downloaded?")
          return
        end
        local resp_ok, response = pcall(vim.json.decode, raw)
        if resp_ok and response then
          if response.response then
            callback(response.response)
          elseif response.error then
            callback("Ollama error: " .. response.error)
          else
            callback("Error: Unexpected response format")
          end
        else
          callback("Error parsing response: " .. raw:sub(1, 200))
        end
      end,
      on_stderr = function(_, data)
        local err = table.concat(data, "")
        if err ~= "" then
          callback("Error: " .. err)
        end
      end,
      on_exit = function(_, exit_code)
        if exit_code ~= 0 then
          vim.schedule(function()
            callback("Error: curl failed with code " .. exit_code)
          end)
        end
      end,
    })
  end)
end

-- Wrap text to a given width
local function wrap_text(text, width)
  local lines = {}
  for paragraph in text:gmatch("[^\n]+") do
    local line = ""
    for word in paragraph:gmatch("%S+") do
      if #line + #word + 1 > width then
        if line ~= "" then table.insert(lines, line) end
        line = word
      else
        line = line == "" and word or (line .. " " .. word)
      end
    end
    if line ~= "" then table.insert(lines, line) end
  end
  return lines
end

-- Open AI assistant as overlay (flashcard stays open underneath)
local function open_ai_assistant()
  close_ai_window()

  local card_ctx = get_current_card_context()
  if not card_ctx then
    vim.notify("No card active - start a review first", vim.log.levels.WARN)
    return
  end

  local width = math.floor(vim.o.columns * 0.7)
  local height = math.floor(vim.o.lines * 0.75)
  local input_height = 3
  local content_width = width - 6  -- Account for padding and border

  -- Create main AI buffer
  local ai_buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_option(ai_buf, "bufhidden", "wipe")

  local ai_win = vim.api.nvim_open_win(ai_buf, false, {
    relative = "editor",
    width = width,
    height = height - input_height - 1,
    col = math.floor((vim.o.columns - width) / 2),
    row = math.floor((vim.o.lines - height) / 2),
    style = "minimal",
    border = "rounded",
    title = " AI Assistant ",
    title_pos = "center",
  })

  -- Enable word wrap
  vim.api.nvim_win_set_option(ai_win, "wrap", true)
  vim.api.nvim_win_set_option(ai_win, "linebreak", true)

  -- Build initial content with card context
  local content = { "" }
  table.insert(content, "  CARD:")
  table.insert(content, "  Q: " .. card_ctx.question)
  table.insert(content, "  A: " .. card_ctx.answer)
  table.insert(content, "")
  table.insert(content, "  " .. string.rep("─", content_width - 2))
  table.insert(content, "")
  table.insert(content, "  Type your question below...")
  table.insert(content, "")

  vim.api.nvim_buf_set_lines(ai_buf, 0, -1, false, content)

  -- Create input buffer
  local input_buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_option(input_buf, "bufhidden", "wipe")

  local input_col = math.floor((vim.o.columns - width) / 2)
  local input_row = math.floor((vim.o.lines - height) / 2) + height - input_height

  -- Create highlight groups for modes
  vim.api.nvim_set_hl(0, "FlashcardModeNormal", { fg = "#1d1f20", bg = "#83a598", bold = true })
  vim.api.nvim_set_hl(0, "FlashcardModeInsert", { fg = "#1d1f20", bg = "#b8bb26", bold = true })
  vim.api.nvim_set_hl(0, "FlashcardModeText", { fg = "#a89984" })

  local input_win = vim.api.nvim_open_win(input_buf, true, {
    relative = "editor",
    width = width,
    height = input_height,
    col = input_col,
    row = input_row,
    style = "minimal",
    border = "rounded",
    title = {
      { " NORMAL ", "FlashcardModeNormal" },
      { " i: insert | q: close | Enter: send ", "FlashcardModeText" },
    },
    title_pos = "center",
  })

  vim.api.nvim_buf_set_option(input_buf, "modifiable", true)
  -- Start in normal mode (no startinsert)

  M.state.ai_buf = ai_buf
  M.state.ai_win = ai_win
  M.state.ai_input_buf = input_buf
  M.state.ai_input_win = input_win

  -- Update title based on mode
  local function update_mode_title(mode)
    if not M.state.ai_input_win or not vim.api.nvim_win_is_valid(M.state.ai_input_win) then
      return
    end
    local title
    if mode == "i" or mode == "insert" then
      title = {
        { " INSERT ", "FlashcardModeInsert" },
        { " Esc: normal | Enter: send ", "FlashcardModeText" },
      }
    else
      title = {
        { " NORMAL ", "FlashcardModeNormal" },
        { " i: insert | q: close | Enter: send ", "FlashcardModeText" },
      }
    end
    vim.api.nvim_win_set_config(M.state.ai_input_win, { title = title, title_pos = "center" })
  end

  -- Mode change autocmds
  local augroup = vim.api.nvim_create_augroup("FlashcardAIMode", { clear = true })
  vim.api.nvim_create_autocmd("InsertEnter", {
    group = augroup,
    buffer = input_buf,
    callback = function() update_mode_title("insert") end,
  })
  vim.api.nvim_create_autocmd("InsertLeave", {
    group = augroup,
    buffer = input_buf,
    callback = function() update_mode_title("normal") end,
  })

  local opts = { buffer = input_buf, silent = true }

  vim.keymap.set("n", "q", close_ai_window, opts)

  vim.keymap.set({"n", "i"}, "<CR>", function()
    local lines = vim.api.nvim_buf_get_lines(input_buf, 0, -1, false)
    local question = table.concat(lines, " "):gsub("^%s+", ""):gsub("%s+$", "")
    if question == "" then return end

    -- Show loading state with card context preserved
    vim.api.nvim_buf_set_option(ai_buf, "modifiable", true)
    local loading = { "" }
    table.insert(loading, "  CARD:")
    table.insert(loading, "  Q: " .. card_ctx.question)
    table.insert(loading, "  A: " .. card_ctx.answer)
    table.insert(loading, "")
    table.insert(loading, "  " .. string.rep("─", content_width - 2))
    table.insert(loading, "")
    table.insert(loading, "  You: " .. question)
    table.insert(loading, "")
    table.insert(loading, "  " .. string.rep("─", content_width - 2))
    table.insert(loading, "")
    table.insert(loading, "  Thinking...")
    vim.api.nvim_buf_set_lines(ai_buf, 0, -1, false, loading)
    vim.api.nvim_buf_set_option(ai_buf, "modifiable", false)

    vim.api.nvim_buf_set_lines(input_buf, 0, -1, false, {""})

    query_ollama(question, function(response)
      vim.schedule(function()
        if not M.state.ai_buf or not vim.api.nvim_buf_is_valid(M.state.ai_buf) then
          return
        end

        local resp = { "" }
        table.insert(resp, "  CARD:")
        table.insert(resp, "  Q: " .. card_ctx.question)
        table.insert(resp, "  A: " .. card_ctx.answer)
        table.insert(resp, "")
        table.insert(resp, "  " .. string.rep("─", content_width - 2))
        table.insert(resp, "")
        table.insert(resp, "  You: " .. question)
        table.insert(resp, "")
        table.insert(resp, "  " .. string.rep("─", content_width - 2))
        table.insert(resp, "")
        table.insert(resp, "  AI:")
        -- Wrap the response text
        local wrapped = wrap_text(response, content_width - 4)
        for _, line in ipairs(wrapped) do
          table.insert(resp, "  " .. line)
        end
        table.insert(resp, "")

        vim.api.nvim_buf_set_option(M.state.ai_buf, "modifiable", true)
        vim.api.nvim_buf_set_lines(M.state.ai_buf, 0, -1, false, resp)
        vim.api.nvim_buf_set_option(M.state.ai_buf, "modifiable", false)
      end)
    end)
  end, opts)
end

-- Parse deck file (tab-separated)
local function parse_deck(filepath)
  local cards = {}
  local file = io.open(filepath, "r")
  if not file then return cards end

  for line in file:lines() do
    -- Skip comments and empty lines
    if not line:match("^#") and not line:match("^%s*$") then
      local question, answer = line:match("^(.-)	(.+)$")
      if question and answer then
        table.insert(cards, { q = question, a = answer })
      end
    end
  end
  file:close()
  return cards
end

-- Get all items (folders and decks) in a directory
local function get_items(dir_path)
  local items = {}
  local handle = vim.loop.fs_scandir(dir_path)
  if handle then
    while true do
      local name, type = vim.loop.fs_scandir_next(handle)
      if not name then break end
      if type == "directory" and not name:match("^%.") then
        table.insert(items, {
          name = name:gsub("^%l", string.upper),
          path = dir_path .. "/" .. name,
          type = "folder",
        })
      elseif type == "file" and name:match("%.txt$") then
        table.insert(items, {
          name = name:gsub("-deck%.txt$", ""):gsub("-", " "):gsub("^%l", string.upper),
          path = dir_path .. "/" .. name,
          type = "deck",
        })
      end
    end
  end
  -- Sort: folders first, then decks
  table.sort(items, function(a, b)
    if a.type ~= b.type then
      return a.type == "folder"
    end
    return a.name < b.name
  end)
  return items
end

-- SM-2 algorithm
local function calculate_next_review(card_id, quality)
  local now = os.time()
  local card_progress = M.state.progress[card_id] or {
    easiness = 2.5,
    interval = 1,
    repetitions = 0,
    next_review = now,
  }

  if quality >= 3 then
    if card_progress.repetitions == 0 then
      card_progress.interval = 1
    elseif card_progress.repetitions == 1 then
      card_progress.interval = 6
    else
      card_progress.interval = math.floor(card_progress.interval * card_progress.easiness)
    end
    card_progress.repetitions = card_progress.repetitions + 1
  else
    card_progress.repetitions = 0
    card_progress.interval = 1
  end

  card_progress.easiness = math.max(1.3, card_progress.easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  card_progress.next_review = now + (card_progress.interval * 86400)

  M.state.progress[card_id] = card_progress
  save_progress()
end

-- Get cards due for review
local function get_due_cards()
  local now = os.time()
  local due = {}

  for i, card in ipairs(M.state.cards) do
    local card_id = M.state.current_deck .. ":" .. i
    local progress = M.state.progress[card_id]
    if not progress or progress.next_review <= now then
      table.insert(due, { index = i, card = card, card_id = card_id })
    end
  end

  return due
end

-- Create floating window
local function create_float(content, title)
  local width = math.floor(vim.o.columns * 0.6)
  local height = math.floor(vim.o.lines * 0.5)

  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_option(buf, "bufhidden", "wipe")

  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    col = math.floor((vim.o.columns - width) / 2),
    row = math.floor((vim.o.lines - height) / 2),
    style = "minimal",
    border = "rounded",
    title = " " .. title .. " ",
    title_pos = "center",
  })

  vim.api.nvim_buf_set_lines(buf, 0, -1, false, content)
  vim.api.nvim_buf_set_option(buf, "modifiable", false)

  -- Enable word wrap
  vim.api.nvim_win_set_option(win, "wrap", true)
  vim.api.nvim_win_set_option(win, "linebreak", true)

  return buf, win
end

-- Close float
close_float = function()
  if M.state.win and vim.api.nvim_win_is_valid(M.state.win) then
    vim.api.nvim_win_close(M.state.win, true)
  end
  M.state.win = nil
  M.state.buf = nil
end

-- Show current card
local function show_card()
  close_float()

  local due = get_due_cards()

  -- Session complete - no more cards
  if #due == 0 then
    if M.state.session_started then
      complete_session(M.state.current_deck)
      local stats = get_deck_stats(M.state.current_deck)
      local _, rec = get_deck_recommendation(stats)
      vim.notify("Session complete! (" .. stats.completed .. " completed, " .. stats.abandoned .. " abandoned) - " .. rec, vim.log.levels.INFO)
    else
      vim.notify("No cards due for review!", vim.log.levels.INFO)
    end
    return
  end

  -- Start session tracking on first card
  if not M.state.session_started then
    start_session(M.state.current_deck)
    M.state.initial_due_count = #due
  end

  local current = due[1]
  M.state.current_index = current.index
  M.state.showing_answer = false

  -- Get deck stats for display
  local stats = get_deck_stats(M.state.current_deck)
  local status, rec = get_deck_recommendation(stats)

  local content = {
    "",
    "  QUESTION:",
    "",
  }

  -- Wrap question text
  local q_lines = vim.split(current.card.q, "\n")
  for _, line in ipairs(q_lines) do
    table.insert(content, "  " .. line)
  end

  table.insert(content, "")
  table.insert(content, "")
  table.insert(content, "  ─────────────────────────────────")
  table.insert(content, "")
  table.insert(content, "  [Space] Show Answer  [a] Ask AI  [q] Quit")
  table.insert(content, "")
  table.insert(content, "  Cards remaining: " .. #due)
  table.insert(content, "")
  table.insert(content, "  ─────────────────────────────────")
  table.insert(content, "  Sessions: " .. stats.completed .. " done / " .. stats.abandoned .. " quit")
  local rate = (stats.completed + stats.abandoned) > 0
    and math.floor(stats.completed / (stats.completed + stats.abandoned) * 100) or 0
  table.insert(content, "  Completion rate: " .. rate .. "% | " .. rec)
  if stats.last_completed then
    table.insert(content, "  Last completed: " .. time_ago(stats.last_completed))
  end

  local deck_name = M.state.current_deck:gsub("-deck$", ""):gsub("-", " ")
  M.state.buf, M.state.win = create_float(content, "Flashcards - " .. deck_name)

  -- Keymaps
  local opts = { buffer = M.state.buf, silent = true }
  vim.keymap.set("n", "<Space>", function() show_answer(current) end, opts)
  vim.keymap.set("n", "a", open_ai_assistant, opts)
  vim.keymap.set("n", "q", function()
    close_ai_window()
    if M.state.session_started then
      abandon_session(M.state.current_deck)
    end
    close_float()
  end, opts)
  vim.keymap.set("n", "<Esc>", function()
    close_ai_window()
    if M.state.session_started then
      abandon_session(M.state.current_deck)
    end
    close_float()
  end, opts)
end

-- Show answer
function show_answer(current)
  if M.state.showing_answer then return end
  M.state.showing_answer = true

  close_float()

  local content = {
    "",
    "  QUESTION:",
    "",
  }

  local q_lines = vim.split(current.card.q, "\n")
  for _, line in ipairs(q_lines) do
    table.insert(content, "  " .. line)
  end

  table.insert(content, "")
  table.insert(content, "  ─────────────────────────────────")
  table.insert(content, "")
  table.insert(content, "  ANSWER:")
  table.insert(content, "")

  local a_lines = vim.split(current.card.a, "\n")
  for _, line in ipairs(a_lines) do
    table.insert(content, "  " .. line)
  end

  table.insert(content, "")
  table.insert(content, "  ─────────────────────────────────")
  table.insert(content, "")
  table.insert(content, "  Rate: [1] Forgot [2] Hard [3] Good [4] Easy")
  table.insert(content, "  [a] Ask AI   [q] Quit")
  table.insert(content, "")

  local deck_name = M.state.current_deck:gsub("-deck$", ""):gsub("-", " ")
  M.state.buf, M.state.win = create_float(content, "Flashcards - " .. deck_name)

  -- Rating keymaps
  local opts = { buffer = M.state.buf, silent = true }
  for i = 1, 4 do
    vim.keymap.set("n", tostring(i), function()
      close_ai_window()
      calculate_next_review(current.card_id, i + 1)
      show_card()
    end, opts)
  end
  vim.keymap.set("n", "a", open_ai_assistant, opts)
  vim.keymap.set("n", "q", function()
    close_ai_window()
    if M.state.session_started then
      abandon_session(M.state.current_deck)
    end
    close_float()
  end, opts)
  vim.keymap.set("n", "<Esc>", function()
    close_ai_window()
    if M.state.session_started then
      abandon_session(M.state.current_deck)
    end
    close_float()
  end, opts)
end

-- Browse and select deck (recursive navigation)
local function browse_and_select(current_path, on_deck_selected)
  local items = get_items(current_path)
  if #items == 0 then
    vim.notify("No items found", vim.log.levels.ERROR)
    return
  end

  vim.ui.select(items, {
    prompt = "Select:",
    format_item = function(item)
      if item.type == "folder" then
        return "📁 " .. item.name
      else
        local card_count = #parse_deck(item.path)
        local deck_id = item.path:gsub(expand_path(M.config.deck_dir) .. "/", ""):gsub("%.txt$", "")
        local stats = M.state.deck_stats[deck_id]

        local stat_str = ""
        if stats and (stats.completed > 0 or stats.abandoned > 0) then
          local total = stats.completed + stats.abandoned
          local rate = math.floor(stats.completed / total * 100)
          local indicator = rate >= 80 and "+" or (rate >= 50 and "~" or "-")
          stat_str = " [" .. indicator .. stats.completed .. "/" .. total .. "]"
        end

        return "📄 " .. item.name .. " (" .. card_count .. " cards)" .. stat_str
      end
    end,
  }, function(choice)
    if not choice then return end

    if choice.type == "folder" then
      -- Drill into folder
      browse_and_select(choice.path, on_deck_selected)
    else
      -- Selected a deck
      on_deck_selected(choice)
    end
  end)
end

-- Select deck
function M.select_deck()
  local deck_dir = expand_path(M.config.deck_dir)
  browse_and_select(deck_dir, function(deck)
    M.state.current_deck = deck.path:gsub(expand_path(M.config.deck_dir) .. "/", ""):gsub("%.txt$", "")
    M.state.cards = parse_deck(deck.path)
    show_card()
  end)
end

-- Start review (with last deck or select)
function M.start()
  load_progress()
  M.select_deck()
end

-- Show stats
function M.stats()
  load_progress()

  local total = 0
  local learned = 0
  local due = 0
  local now = os.time()

  for _, data in pairs(M.state.progress) do
    total = total + 1
    if data.repetitions >= 3 then
      learned = learned + 1
    end
    if data.next_review <= now then
      due = due + 1
    end
  end

  -- Calculate deck session stats
  local total_completed = 0
  local total_abandoned = 0
  local deck_lines = {}

  for deck_id, stats in pairs(M.state.deck_stats) do
    total_completed = total_completed + stats.completed
    total_abandoned = total_abandoned + stats.abandoned

    local deck_name = deck_id:gsub("-deck$", ""):gsub("-", " "):gsub("^%l", string.upper)
    -- Shorten path for display
    deck_name = deck_name:match("[^/]+$") or deck_name

    local total_sessions = stats.completed + stats.abandoned
    if total_sessions > 0 then
      local rate = math.floor(stats.completed / total_sessions * 100)
      local indicator = rate >= 80 and "+" or (rate >= 50 and "~" or "-")
      local last = stats.last_completed and time_ago(stats.last_completed) or "never"
      table.insert(deck_lines, {
        name = deck_name,
        line = string.format("  %s %-20s %2d/%2d (%3d%%) last: %s",
          indicator, deck_name:sub(1, 20), stats.completed, total_sessions, rate, last),
        rate = rate,
      })
    end
  end

  -- Sort by completion rate (needs work first)
  table.sort(deck_lines, function(a, b) return a.rate < b.rate end)

  local content = {
    "",
    "  FLASHCARD STATISTICS",
    "",
    "  ─────────────────────────────────",
    "",
    "  CARDS",
    "  Total tracked: " .. total,
    "  Learned (3+ reps): " .. learned,
    "  Due for review: " .. due,
    "",
    "  ─────────────────────────────────",
    "",
    "  SESSIONS",
    "  Total completed: " .. total_completed,
    "  Total abandoned: " .. total_abandoned,
  }

  if total_completed + total_abandoned > 0 then
    local overall_rate = math.floor(total_completed / (total_completed + total_abandoned) * 100)
    table.insert(content, "  Overall completion rate: " .. overall_rate .. "%")
  end

  if #deck_lines > 0 then
    table.insert(content, "")
    table.insert(content, "  ─────────────────────────────────")
    table.insert(content, "")
    table.insert(content, "  DECK BREAKDOWN (sorted by need)")
    table.insert(content, "  [+] good  [~] needs review  [-] needs work")
    table.insert(content, "")
    for _, d in ipairs(deck_lines) do
      table.insert(content, d.line)
    end
  end

  table.insert(content, "")
  table.insert(content, "  ─────────────────────────────────")
  table.insert(content, "")
  table.insert(content, "  [q] Close")
  table.insert(content, "")

  M.state.buf, M.state.win = create_float(content, "Flashcard Stats")

  local opts = { buffer = M.state.buf, silent = true }
  vim.keymap.set("n", "q", close_float, opts)
  vim.keymap.set("n", "<Esc>", close_float, opts)
end

-- Shuffle helper
local function shuffle(tbl)
  for i = #tbl, 2, -1 do
    local j = math.random(i)
    tbl[i], tbl[j] = tbl[j], tbl[i]
  end
  return tbl
end

-- Drill mode: start next round
local function drill_start_round()
  -- Move missed cards to new round
  M.state.drill_round = M.state.drill_missed
  M.state.drill_missed = {}
  M.state.drill_round_num = M.state.drill_round_num + 1
  shuffle(M.state.drill_round)
end

-- Drill mode: show next card
local function drill_show_card()
  close_float()

  -- Check if round is complete
  if #M.state.drill_round == 0 then
    if #M.state.drill_missed == 0 then
      -- No missed cards = all mastered!
      if M.state.session_started then
        complete_session(M.state.current_deck)
        local stats = get_deck_stats(M.state.current_deck)
        vim.notify("All cards mastered! (" .. stats.completed .. " completed, " .. stats.abandoned .. " abandoned)", vim.log.levels.INFO)
      else
        vim.notify("All cards mastered! Session complete.", vim.log.levels.INFO)
      end
      M.state.drill_mode = false
      return
    else
      -- Start next round with missed cards
      drill_start_round()
      vim.notify("Round " .. M.state.drill_round_num .. ": " .. #M.state.drill_round .. " cards to review", vim.log.levels.INFO)
    end
  end

  -- Get next card from current round
  local card_idx = table.remove(M.state.drill_round, 1)
  local card = M.state.cards[card_idx]
  M.state.current_index = card_idx
  M.state.showing_answer = false

  local streak = M.state.drill_streak[card_idx] or 0
  local remaining = #M.state.drill_round + 1
  local mastered = 0
  for _, s in pairs(M.state.drill_streak) do
    if s >= M.state.drill_target then mastered = mastered + 1 end
  end
  local next_round = #M.state.drill_missed

  local content = {
    "",
    "  ⚡ DRILL MODE - Round " .. M.state.drill_round_num,
    "",
    "  Progress: " .. mastered .. "/" .. #M.state.cards .. " mastered",
    "  This round: " .. remaining .. " left | Next round: " .. next_round .. " queued",
    "  This card: " .. streak .. "/" .. M.state.drill_target .. " streak",
    "",
    "  ─────────────────────────────────",
    "",
    "  QUESTION:",
    "",
  }

  local q_lines = vim.split(card.q, "\n")
  for _, line in ipairs(q_lines) do
    table.insert(content, "  " .. line)
  end

  table.insert(content, "")
  table.insert(content, "  ─────────────────────────────────")
  table.insert(content, "")
  table.insert(content, "  [Space] Show Answer  [a] Ask AI  [q] Quit")

  local deck_name = M.state.current_deck:gsub("-deck$", ""):gsub("-", " ")
  M.state.buf, M.state.win = create_float(content, "Drill - " .. deck_name)

  local opts = { buffer = M.state.buf, silent = true }
  vim.keymap.set("n", "<Space>", function() drill_show_answer(card_idx, card) end, opts)
  vim.keymap.set("n", "a", open_ai_assistant, opts)
  vim.keymap.set("n", "q", function()
    close_ai_window()
    if M.state.session_started then
      abandon_session(M.state.current_deck)
    end
    close_float()
    M.state.drill_mode = false
  end, opts)
  vim.keymap.set("n", "<Esc>", function()
    close_ai_window()
    if M.state.session_started then
      abandon_session(M.state.current_deck)
    end
    close_float()
    M.state.drill_mode = false
  end, opts)
end

-- Drill mode: show answer
function drill_show_answer(card_idx, card)
  if M.state.showing_answer then return end
  M.state.showing_answer = true
  close_float()

  local streak = M.state.drill_streak[card_idx] or 0

  local content = {
    "",
    "  ⚡ DRILL MODE",
    "",
    "  ─────────────────────────────────",
    "",
    "  QUESTION:",
    "",
  }

  local q_lines = vim.split(card.q, "\n")
  for _, line in ipairs(q_lines) do
    table.insert(content, "  " .. line)
  end

  table.insert(content, "")
  table.insert(content, "  ─────────────────────────────────")
  table.insert(content, "")
  table.insert(content, "  ANSWER:")
  table.insert(content, "")

  local a_lines = vim.split(card.a, "\n")
  for _, line in ipairs(a_lines) do
    table.insert(content, "  " .. line)
  end

  table.insert(content, "")
  table.insert(content, "  ─────────────────────────────────")
  table.insert(content, "")
  table.insert(content, "  Did you get it right?")
  table.insert(content, "  [y] Yes (+" .. (streak + 1) .. "/" .. M.state.drill_target .. ")  [n] No (reset)")
  table.insert(content, "  [a] Ask AI   [q] Quit")

  local deck_name = M.state.current_deck:gsub("-deck$", ""):gsub("-", " ")
  M.state.buf, M.state.win = create_float(content, "Drill - " .. deck_name)

  local opts = { buffer = M.state.buf, silent = true }

  -- Yes - got it right
  vim.keymap.set("n", "y", function()
    close_ai_window()
    M.state.drill_streak[card_idx] = (M.state.drill_streak[card_idx] or 0) + 1
    if M.state.drill_streak[card_idx] < M.state.drill_target then
      -- Not mastered yet, add to next round
      table.insert(M.state.drill_missed, card_idx)
    end
    drill_show_card()
  end, opts)

  -- No - got it wrong
  vim.keymap.set("n", "n", function()
    close_ai_window()
    M.state.drill_streak[card_idx] = 0
    -- Add to next round
    table.insert(M.state.drill_missed, card_idx)
    drill_show_card()
  end, opts)

  vim.keymap.set("n", "a", open_ai_assistant, opts)
  vim.keymap.set("n", "q", function()
    close_ai_window()
    if M.state.session_started then
      abandon_session(M.state.current_deck)
    end
    close_float()
    M.state.drill_mode = false
  end, opts)
  vim.keymap.set("n", "<Esc>", function()
    close_ai_window()
    if M.state.session_started then
      abandon_session(M.state.current_deck)
    end
    close_float()
    M.state.drill_mode = false
  end, opts)
end

-- Start drill mode
function M.drill()
  load_progress()
  local deck_dir = expand_path(M.config.deck_dir)
  browse_and_select(deck_dir, function(deck)
    M.state.current_deck = deck.path:gsub(expand_path(M.config.deck_dir) .. "/", ""):gsub("%.txt$", "")
    M.state.cards = parse_deck(deck.path)
    M.state.drill_mode = true
    M.state.drill_streak = {}
    M.state.drill_missed = {}
    M.state.drill_round_num = 1

    -- Start session tracking
    start_session(M.state.current_deck)

    -- Initialize round 1 with all cards shuffled
    M.state.drill_round = {}
    for i = 1, #M.state.cards do
      table.insert(M.state.drill_round, i)
    end
    shuffle(M.state.drill_round)

    vim.notify("Round 1: " .. #M.state.drill_round .. " cards", vim.log.levels.INFO)
    drill_show_card()
  end)
end

-- Setup
function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})

  vim.api.nvim_create_user_command("FlashcardStart", M.start, {})
  vim.api.nvim_create_user_command("FlashcardDecks", M.select_deck, {})
  vim.api.nvim_create_user_command("FlashcardStats", M.stats, {})
  vim.api.nvim_create_user_command("FlashcardDrill", M.drill, {})

  load_progress()
end

return M
