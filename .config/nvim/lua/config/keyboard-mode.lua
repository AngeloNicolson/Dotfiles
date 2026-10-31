-- Publish vim's mode to $XDG_RUNTIME_DIR/nvim-mode so the keyboard lighting
-- daemon (~/.config/themes/keyboard-reactive.py) can colour Esc / Caps by mode.
-- One byte per change; cleared when nvim loses focus or exits.
local dir = os.getenv("XDG_RUNTIME_DIR")
if not dir then return end
local path = dir .. "/nvim-mode"

local function publish(mode)
	local f = io.open(path, "w")
	if f then f:write(mode or ""); f:close() end
end

local g = vim.api.nvim_create_augroup("keyboard-mode", { clear = true })
vim.api.nvim_create_autocmd("ModeChanged", { group = g, callback = function() publish(vim.fn.mode()) end })
vim.api.nvim_create_autocmd({ "FocusGained", "VimEnter" }, { group = g, callback = function() publish(vim.fn.mode()) end })
vim.api.nvim_create_autocmd({ "FocusLost", "VimLeavePre" }, { group = g, callback = function() publish("") end })
