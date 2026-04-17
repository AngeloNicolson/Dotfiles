local M = {}

local DEFAULT_MODEL = "qwen3-coder:30b"
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

local function apply_avante_model(model)
	local ok_config, avante_config = pcall(require, "avante.config")
	if not ok_config then
		return
	end

	avante_config.override({
		providers = {
			ollama = vim.tbl_deep_extend("force", avante_config.get_provider_config("ollama"), {
				model = model,
			}),
		},
	})
	avante_config.save_last_model(model, "ollama")

	local ok_providers, avante_providers = pcall(require, "avante.providers")
	if ok_providers and avante_providers.ollama then
		avante_providers.ollama.model = model
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
	apply_avante_model(model)
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

return M
