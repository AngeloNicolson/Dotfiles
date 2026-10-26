return {
	{
		"nvim-treesitter/nvim-treesitter",
		branch = "master",
		build = ":TSUpdate",
		config = function()
			require("nvim-treesitter.configs").setup({
				ensure_installed = {
					"bash",
					"c",
					"clojure",
					"cmake",
					"cpp",
					"cuda",
					"c_sharp",
					"glsl",
					"html",
					"javascript",
					"json",
					"lua",
					"markdown",
					"markdown_inline", -- codecompanion chat buffers
					"python",
					"query",
					"vim",
					"vimdoc",
					"yaml",
				},
				sync_install = false,
				auto_install = true,
				highlight = {
					enable = true,
					additional_vim_regex_highlighting = false,
				},
			})
		end,
	},
}
