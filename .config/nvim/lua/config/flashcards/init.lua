local M = {}

M.config = {
  deck_dir = "~/knowledge_vault/Study-Vault/Anki",
  data_file = "~/.local/share/nvim/flashcards_progress.json",
}

M.state = {
  current_deck = nil,
  cards = {},
  current_index = 0,
  showing_answer = false,
  progress = {},
  buf = nil,
  win = nil,
  -- Drill mode state
  drill_mode = false,
  drill_queue = {},
  drill_streak = {},  -- tracks consecutive correct answers per card
  drill_target = 3,   -- need 3 correct in a row to master
}

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
      M.state.progress = data
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
    file:write(vim.json.encode(M.state.progress))
    file:close()
  end
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

  return buf, win
end

-- Close float
local function close_float()
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
  if #due == 0 then
    vim.notify("No cards due for review!", vim.log.levels.INFO)
    return
  end

  local current = due[1]
  M.state.current_index = current.index
  M.state.showing_answer = false

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
  table.insert(content, "  [Space] Show Answer    [q] Quit")
  table.insert(content, "")
  table.insert(content, "  Cards remaining: " .. #due)

  local deck_name = M.state.current_deck:gsub("-deck$", ""):gsub("-", " ")
  M.state.buf, M.state.win = create_float(content, "Flashcards - " .. deck_name)

  -- Keymaps
  local opts = { buffer = M.state.buf, silent = true }
  vim.keymap.set("n", "<Space>", function() show_answer(current) end, opts)
  vim.keymap.set("n", "q", close_float, opts)
  vim.keymap.set("n", "<Esc>", close_float, opts)
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
  table.insert(content, "  Rate your recall:")
  table.insert(content, "  [1] Forgot  [2] Hard  [3] Good  [4] Easy")
  table.insert(content, "")

  local deck_name = M.state.current_deck:gsub("-deck$", ""):gsub("-", " ")
  M.state.buf, M.state.win = create_float(content, "Flashcards - " .. deck_name)

  -- Rating keymaps
  local opts = { buffer = M.state.buf, silent = true }
  for i = 1, 4 do
    vim.keymap.set("n", tostring(i), function()
      calculate_next_review(current.card_id, i + 1)
      show_card()
    end, opts)
  end
  vim.keymap.set("n", "q", close_float, opts)
  vim.keymap.set("n", "<Esc>", close_float, opts)
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
        return "📄 " .. item.name .. " (" .. card_count .. " cards)"
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

  local content = {
    "",
    "  FLASHCARD STATISTICS",
    "",
    "  ─────────────────────────────────",
    "",
    "  Total cards tracked: " .. total,
    "  Cards learned (3+ reps): " .. learned,
    "  Cards due for review: " .. due,
    "",
    "  ─────────────────────────────────",
    "",
    "  [q] Close",
    "",
  }

  M.state.buf, M.state.win = create_float(content, "Flashcard Stats")

  local opts = { buffer = M.state.buf, silent = true }
  vim.keymap.set("n", "q", close_float, opts)
  vim.keymap.set("n", "<Esc>", close_float, opts)
end

-- Drill mode: show next card
local function drill_show_card()
  close_float()

  if #M.state.drill_queue == 0 then
    vim.notify("🎉 All cards mastered! Session complete.", vim.log.levels.INFO)
    M.state.drill_mode = false
    return
  end

  -- Get next card from queue
  local card_idx = table.remove(M.state.drill_queue, 1)
  local card = M.state.cards[card_idx]
  M.state.current_index = card_idx
  M.state.showing_answer = false

  local streak = M.state.drill_streak[card_idx] or 0
  local remaining = #M.state.drill_queue + 1
  local mastered = 0
  for _, s in pairs(M.state.drill_streak) do
    if s >= M.state.drill_target then mastered = mastered + 1 end
  end

  local content = {
    "",
    "  ⚡ DRILL MODE",
    "",
    "  Progress: " .. mastered .. "/" .. #M.state.cards .. " mastered | " .. remaining .. " in queue",
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
  table.insert(content, "  [Space] Show Answer    [q] Quit")

  local deck_name = M.state.current_deck:gsub("-deck$", ""):gsub("-", " ")
  M.state.buf, M.state.win = create_float(content, "Drill - " .. deck_name)

  local opts = { buffer = M.state.buf, silent = true }
  vim.keymap.set("n", "<Space>", function() drill_show_answer(card_idx, card) end, opts)
  vim.keymap.set("n", "q", function()
    close_float()
    M.state.drill_mode = false
  end, opts)
  vim.keymap.set("n", "<Esc>", function()
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
  table.insert(content, "  [y] Yes (+" .. (streak + 1) .. "/" .. M.state.drill_target .. ")    [n] No (reset streak)")

  local deck_name = M.state.current_deck:gsub("-deck$", ""):gsub("-", " ")
  M.state.buf, M.state.win = create_float(content, "Drill - " .. deck_name)

  local opts = { buffer = M.state.buf, silent = true }

  -- Yes - got it right
  vim.keymap.set("n", "y", function()
    M.state.drill_streak[card_idx] = (M.state.drill_streak[card_idx] or 0) + 1
    if M.state.drill_streak[card_idx] < M.state.drill_target then
      -- Not mastered yet, add back to queue (later position)
      local pos = math.min(#M.state.drill_queue + 1, math.random(3, math.max(5, #M.state.drill_queue)))
      table.insert(M.state.drill_queue, pos, card_idx)
    end
    drill_show_card()
  end, opts)

  -- No - got it wrong
  vim.keymap.set("n", "n", function()
    M.state.drill_streak[card_idx] = 0
    -- Add back to queue soon
    local pos = math.min(#M.state.drill_queue + 1, math.random(1, 3))
    table.insert(M.state.drill_queue, pos, card_idx)
    drill_show_card()
  end, opts)

  vim.keymap.set("n", "q", function()
    close_float()
    M.state.drill_mode = false
  end, opts)
  vim.keymap.set("n", "<Esc>", function()
    close_float()
    M.state.drill_mode = false
  end, opts)
end

-- Start drill mode
function M.drill()
  local deck_dir = expand_path(M.config.deck_dir)
  browse_and_select(deck_dir, function(deck)
    M.state.current_deck = deck.path:gsub(expand_path(M.config.deck_dir) .. "/", ""):gsub("%.txt$", "")
    M.state.cards = parse_deck(deck.path)
    M.state.drill_mode = true
    M.state.drill_streak = {}

    -- Shuffle cards into queue
    M.state.drill_queue = {}
    for i = 1, #M.state.cards do
      table.insert(M.state.drill_queue, i)
    end
    -- Shuffle
    for i = #M.state.drill_queue, 2, -1 do
      local j = math.random(i)
      M.state.drill_queue[i], M.state.drill_queue[j] = M.state.drill_queue[j], M.state.drill_queue[i]
    end

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
