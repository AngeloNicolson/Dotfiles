return {
	{
		"uga-rosa/ccc.nvim",
		-- Prefix ownership: <leader>w (Windows/appearance utility)
		event = { "BufReadPost", "BufNewFile" }, -- inline colour highlighter wants real buffers
		cmd = { "CccPick", "CccHighlighterToggle", "CccHighlighterEnable", "CccConvert" },
		keys = {
			{ "<leader>wp", "<cmd>CccPick<cr>", desc = "Window color picker" },
			{ "<leader>wh", "<cmd>CccHighlighterToggle<cr>", desc = "Window color highlight" },
		},
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
		end,
	},
}
