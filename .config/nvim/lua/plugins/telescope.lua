return {
	{
		"nvim-telescope/telescope.nvim",
		-- Prefix ownership: <leader>s / <leader>h (Search/Help). Also the
		-- vim.ui.select backend (ui-select extension) and the LSP pickers.
		cmd = "Telescope",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-telescope/telescope-ui-select.nvim",
			"nvim-telescope/telescope-media-files.nvim",
		},
		keys = {
			{ "<leader>sf", function() require("telescope.builtin").find_files() end, desc = "Search files" },
			{ "<c-p>", function() require("telescope.builtin").git_files() end, desc = "Search git files" },
			{ "<leader>sg", function()
				require("telescope.builtin").grep_string({ search = vim.fn.input("Grep > ") })
			end, desc = "Search grep" },
			{ "<leader>sl", function() require("telescope.builtin").live_grep() end, desc = "Search live grep" },
			{ "<leader>sm", function()
				require("telescope").extensions.media_files.media_files({
					search_dirs = { "~/personal/Media", "~/study/massey_mainframe" },
				})
			end, desc = "Search media" },
		},
		init = function()
			-- Route vim.ui.select through telescope even before the first picker:
			-- loading the plugin runs config() -> load_extension("ui-select"),
			-- which replaces vim.ui.select; fall back to the builtin otherwise.
			local builtin_select = vim.ui.select
			local lazy_select
			lazy_select = function(...)
				require("telescope")
				if vim.ui.select ~= lazy_select then
					return vim.ui.select(...)
				end
				return builtin_select(...)
			end
			vim.ui.select = lazy_select
		end,
		config = function()
			local telescope = require("telescope")
			telescope.setup({
				extensions = {
					["ui-select"] = { require("telescope.themes").get_dropdown({}) },
					media_files = {
						filetypes = { "png", "jpg", "jpeg", "mp4", "webm", "mkv", "pdf" },
						find_cmd = "rg",
					},
				},
			})
			telescope.load_extension("ui-select")
			telescope.load_extension("media_files")
		end,
	},
}
