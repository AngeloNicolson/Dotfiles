return {

	-- Obsidian
	{
		"epwalsh/obsidian.nvim",
		tag = "*",
		dependencies = {
			"nvim-lua/plenary.nvim",
		},
	},

	-- Markdown Preview
	{
		"iamcco/markdown-preview.nvim",
		build = "cd app && npm install",
		setup = function()
			vim.g.mkdp_filetypes = { "markdown" }
		end,
		ft = { "markdown" },
	},

	-- File Browser
	{
		"nvim-telescope/telescope-file-browser.nvim",
		dependencies = { "nvim-telescope/telescope.nvim", "nvim-lua/plenary.nvim" },
	},
	{
		"folke/which-key.nvim",
		event = "VeryLazy",
		init = function()
			vim.o.timeout = true
			vim.o.timeoutlen = 500 -- Show after 500ms
		end,
		opts = {
			preset = "modern",
			icons = {
				separator = "→",
			},
		},
		config = function(_, opts)
			local wk = require("which-key")
			wk.setup(opts)
			require("config.keymaps").register_groups()
		end,
		keys = {
			{
				"<leader>hb",
				function()
					require("which-key").show({ global = false })
				end,
				desc = "Help buffer keymaps",
			},
		},
	},
}
