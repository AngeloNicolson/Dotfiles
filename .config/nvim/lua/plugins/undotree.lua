return {
	"jiaoshijie/undotree",
	-- Prefix ownership: <leader>w (Windows/Tools)
	dependencies = "nvim-lua/plenary.nvim",
	config = true,
	keys = { -- load the plugin only when using it's keybinding:
		{ "<leader>wu", "<cmd>lua require('undotree').toggle()<cr>", desc = "Windows undo tree" },
	},
}
