return {
	"kkoomen/vim-doge",
	build = ":call doge#install()",
	ft = { "c", "cpp" },
	init = function()
		vim.g.doge_doc_standard_c = "doxygen_qt"
		vim.g.doge_doc_standard_cpp = "doxygen_qt"
		vim.g.doge_mapping_comment_jump_forward = "<Tab>"
		vim.g.doge_mapping_comment_jump_backward = "<S-Tab>"
		vim.g.doge_mapping = ""  -- disable auto mapping, we set it manually below
	end,
	config = function()
		vim.keymap.set("n", "<leader>lgd", "<cmd>DogeGenerate<cr>", { desc = "Generate Doxygen comment" })
	end,
}
