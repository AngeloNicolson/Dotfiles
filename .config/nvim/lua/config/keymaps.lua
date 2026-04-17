local M = {}

-- Keymap policy:
-- - Global/editor mappings live in config.remaps.
-- - Plugin-specific mappings stay with their plugin config.
-- - This module owns only the prefix namespace and which-key grouping.
M.groups = {
	{ "<leader>a", group = "AI" },
	{ "<leader>b", group = "Build" },
	{ "<leader>bc", group = "CMake" },
	{ "<leader>bo", group = "Overseer" },
	{ "<leader>c", group = "Clipboard" },
	{ "<leader>d", group = "Debug" },
	{ "<leader>f", group = "Files" },
	{ "<leader>g", group = "Git" },
	{ "<leader>h", group = "Help" },
	{ "<leader>l", group = "Language" },
	{ "<leader>lc", group = "Clangd" },
	{ "<leader>o", group = "Open" },
	{ "<leader>r", group = "Refactor" },
	{ "<leader>s", group = "Search" },
	{ "<leader>w", group = "Windows" },
	{ "<leader>x", group = "Diagnostics" },
}

function M.register_groups()
	local ok, wk = pcall(require, "which-key")
	if not ok then
		return
	end

	wk.add(M.groups)
end

return M
