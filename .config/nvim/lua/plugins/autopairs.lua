return {
	"windwp/nvim-autopairs",
	event = "InsertEnter",
	dependencies = { "hrsh7th/nvim-cmp" },
	config = function()
		require("nvim-autopairs").setup({})

		-- Integrate with cmp so pairs insert after confirming a completion
		local cmp_autopairs = require("nvim-autopairs.completion.cmp")
		require("cmp").event:on("confirm_done", cmp_autopairs.on_confirm_done())

		-- Allman-style brace expansion for C/C++
		vim.api.nvim_create_autocmd("FileType", {
			pattern = { "c", "cpp" },
			callback = function()
				vim.keymap.set("i", "{<CR>", "<CR>{<CR>}<Esc>O", { buffer = true })
			end,
		})
	end,
}
