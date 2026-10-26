return {
	"tpope/vim-fugitive",
	-- Prefix ownership: <leader>g (Git)
	cmd = { "Git", "G", "Gdiffsplit", "Gvdiffsplit", "Gread", "Gwrite", "Ggrep", "GMove", "GDelete", "GBrowse", "Gedit", "Gsplit", "Gclog" },
	keys = {
		{ "<leader>gs", "<cmd>Git<cr>", desc = "Git status (fugitive)" },
	},
}
