return {
	{
		"uga-rosa/ccc.nvim",
		config = function()
			local ccc = require("ccc")
			ccc.setup({
				-- Enable inline color highlighting
				highlighter = {
					auto_enable = true,
					lsp = true,
				},
				-- Color picker settings
				picker = {
					enable = true,
				},
				-- Recognize various color formats
				recognize = {
					output = true,
				},
				-- Color formats to support
				outputs = {
					ccc.output.hex,
					ccc.output.css_rgb,
					ccc.output.css_hsl,
				},
				-- Highlight formats
				highlight_mode = "bg", -- or "fg", "virtual"
			})

			-- Keybind: <leader>cp to open color picker
			vim.keymap.set("n", "<leader>cp", "<cmd>CccPick<cr>", { desc = "Color picker" })

			-- Keybind: <leader>ct to toggle color highlighting
			vim.keymap.set("n", "<leader>ct", "<cmd>CccHighlighterToggle<cr>", { desc = "Toggle color highlighting" })
		end,
	},
}
