return {
	"lukas-reineke/indent-blankline.nvim",
	main = "ibl",
	opts = {},

	config = function()
		-- Enable true color support
		vim.opt.termguicolors = true
		vim.opt.list = true
		vim.opt.listchars:append("eol:↴")

		-- Custom highlight for indentation lines. Registered as an ibl hook so
		-- they come back after a colorscheme change (`highlight clear` wipes
		-- them, and ibl errors if they're missing on ColorScheme).
		local hooks = require("ibl.hooks")
		hooks.register(hooks.type.HIGHLIGHT_SETUP, function()
			vim.api.nvim_set_hl(0, "IndentBlanklineIndent2", { fg = "#262626" })
			vim.api.nvim_set_hl(0, "IblScope", { fg = "#3a3a3a" })
		end)

		-- Setup indent-blankline plugin
		require("ibl").setup({
			indent = {
				highlight = { "IndentBlanklineIndent2" },
			},
			scope = { enabled = false },
			-- Optional: Exclude specific file types or buffer types
			exclude = {
				filetypes = { "help", "dashboard", "NvimTree", "lazy" },
				buftypes = { "terminal" },
			},
		})
	end,
}
