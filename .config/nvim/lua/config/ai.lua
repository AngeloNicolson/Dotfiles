local M = {}

local DEFAULT_MODEL = "qwen3.8:27b"
local MONOLITH = vim.fn.exepath("monolith")

local current_model = nil

local function systemlist(cmd)
	local result = vim.fn.systemlist(cmd)
	if vim.v.shell_error ~= 0 then
		return nil
	end
	return result
end

local function monolith_command(args)
	if MONOLITH == "" then
		return nil
	end
	return vim.list_extend({ MONOLITH }, args)
end

local function read_selected_model()
	local cmd = monolith_command({ "selected" })
	if not cmd then
		return nil
	end
	local lines = systemlist(cmd)
	if not lines or not lines[1] or lines[1] == "" then
		return nil
	end
	return lines[1]
end

local function read_current_model()
	local cmd = monolith_command({ "current" })
	if not cmd then
		return nil
	end
	local lines = systemlist(cmd)
	if not lines or not lines[1] or lines[1] == "" then
		return nil
	end
	return lines[1]
end

local function list_models()
	local cmd = monolith_command({ "list", "--plain" })
	if not cmd then
		return {}
	end
	local lines = systemlist(cmd)
	if not lines then
		return {}
	end

	local models = {}
	for _, line in ipairs(lines) do
		if line ~= "" then
			local parts = vim.split(line, "\t", { plain = true })
			table.insert(models, {
				name = parts[1],
				details = parts[2] or "",
			})
		end
	end
	return models
end

-- CodeCompanion resolves the ollama adapter's model lazily (schema.model.default
-- is a function, see plugins/codecompanion.lua), so new chats pick the selected
-- model up on their own; an already-open chat keeps the model it started with.
local function apply_codecompanion_model(model)
	local ok, cc = pcall(require, "codecompanion")
	if not ok then
		return
	end
	local ok_chat, chat = pcall(function()
		return cc.last_chat()
	end)
	if ok_chat and chat and chat.adapter and chat.adapter.name == "ollama" then
		pcall(require("codecompanion.adapters").set_model, { adapter = chat.adapter, model = model })
	end
end

function M.get_current_model()
	if current_model and current_model ~= "" then
		return current_model
	end

	current_model = read_selected_model() or read_current_model() or DEFAULT_MODEL
	return current_model
end

function M.set_current_model(model)
	if not model or model == "" then
		return false
	end

	local cmd = monolith_command({ "select", model })
	if not cmd then
		vim.notify("monolith not found in PATH", vim.log.levels.ERROR)
		return false
	end

	vim.fn.system(cmd)
	if vim.v.shell_error ~= 0 then
		vim.notify("Failed to select model via monolith", vim.log.levels.ERROR)
		return false
	end

	current_model = model
	apply_codecompanion_model(model)
	vim.notify("AI model: " .. model, vim.log.levels.INFO)
	return true
end

function M.select_model()
	local models = list_models()
	if #models == 0 then
		vim.notify("No Ollama models available from monolith", vim.log.levels.WARN)
		return
	end

	local current = M.get_current_model()
	vim.ui.select(models, {
		prompt = "Select AI model",
		format_item = function(item)
			local label = item.name
			if item.details ~= "" then
				label = string.format("%s - %s", item.name, item.details)
			end
			if item.name == current then
				label = label .. " [current]"
			end
			return label
		end,
	}, function(choice)
		if not choice then
			return
		end
		M.set_current_model(choice.name)
	end)
end

function M.setup()
	vim.api.nvim_create_user_command("AIModels", function()
		M.select_model()
	end, { desc = "Select local AI model" })
end

-- Explain the visual selection, or in normal mode the function the cursor is
-- in (treesitter walks up to the enclosing definition and selects it first).
-- Runs the "Explain" prompt from codecompanion's prompt library.
local FUNCTION_NODES = {
	function_definition = true, function_declaration = true, method_definition = true,
	method_declaration = true, function_item = true, lambda_expression = true,
	arrow_function = true, function_expression = true, list_lit = true, -- clojure defn
}
function M.explain(opts)
	opts = opts or {}
	if opts.visual then
		vim.cmd("'<,'>CodeCompanion /explain")
		return
	end
	local ok, node = pcall(vim.treesitter.get_node)
	if not ok or not node then
		vim.notify("AI explain: no treesitter node under the cursor", vim.log.levels.WARN)
		return
	end
	while node and not FUNCTION_NODES[node:type()] do
		node = node:parent()
	end
	if not node then
		vim.notify("AI explain: not inside a function — select the code and try again", vim.log.levels.WARN)
		return
	end
	local sr, sc, er, ec = node:range()
	vim.api.nvim_win_set_cursor(0, { sr + 1, sc })
	vim.cmd("normal! v")
	vim.api.nvim_win_set_cursor(0, { er + 1, math.max(ec - 1, 0) })
	vim.cmd("normal! \27") -- leave visual so '< '> marks are set
	vim.cmd("'<,'>CodeCompanion /explain")
end

return M
