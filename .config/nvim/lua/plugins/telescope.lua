return {
	-- Telescope plugin
	{
		"nvim-telescope/telescope.nvim",
		-- Prefix ownership: <leader>s / <leader>h (Search/Help)
		dependencies = {
			"nvim-lua/plenary.nvim", -- Required dependency
			"nvim-telescope/telescope-ui-select.nvim", -- Add this line
			"nvim-telescope/telescope-media-files.nvim",
		},
		config = function()
			local builtin = require("telescope.builtin")
			local telescope = require("telescope")

			-- Set up Telescope with your key mappings
			vim.keymap.set("n", "<leader>sf", builtin.find_files, { desc = "Search files" })
			vim.keymap.set("n", "<c-p>", builtin.git_files, {})
			vim.keymap.set("n", "<leader>sg", function()
				builtin.grep_string({ search = vim.fn.input("Grep > ") })
			end, { desc = "Search grep" })

			vim.keymap.set("n", "<leader>sm", function()
				require("telescope").extensions.media_files.media_files({
					search_dirs = { "~/personal/Media", "~/study/massey_mainframe" },
				})
			end, { desc = "Search media" })

			-- Telescope setup with extensions and floating window configuration
			telescope.setup({
				extensions = {
					media_files = {
						filetypes = { "png", "jpg", "jpeg", "mp4", "webm", "mkv", "pdf" },
						find_cmd = "rg",
					},
				},
			})
			telescope.load_extension("media_files")
		end,
	},

	-- Optional: Add any other extensions or configurations below as needed.
}
