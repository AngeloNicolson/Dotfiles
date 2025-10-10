return {
	{
		"nvim-neo-tree/neo-tree.nvim",
		branch = "v3.x",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-tree/nvim-web-devicons",
			"MunifTanjim/nui.nvim",
		},
		config = function()
			require("neo-tree").setup({
				filesystem = {
					filtered_items = {
						visible = true, -- Show hidden files
						hide_dotfiles = false,
						hide_gitignored = false,
					},
				},
				event_handlers = {
					{
						event = "file_opened",
						handler = function()
							-- Close neo-tree when a file is opened
							require("neo-tree.command").execute({ action = "close" })
						end,
					},
				},
			})
		end,
	},
}

