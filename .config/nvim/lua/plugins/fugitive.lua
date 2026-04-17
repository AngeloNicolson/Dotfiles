return {
	"tpope/vim-fugitive",
	-- Prefix ownership: <leader>g (Git)
	dependencies = {}, -- No dependencies, so leave it as an empty table
	config = function()
		-- Key mapping for ':Git'
		vim.keymap.set("n", "<leader>gs", vim.cmd.Git)
	end,
}
