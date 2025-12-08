return {
	"p00f/clangd_extensions.nvim",
	dependencies = { "neovim/nvim-lspconfig" },
	ft = { "c", "cpp", "objc", "objcpp", "cuda", "proto" },
	opts = {
		inlay_hints = {
			inline = vim.fn.has("nvim-0.10") == 1,
			only_current_line = false,
			only_current_line_autocmd = "CursorHold",
			show_parameter_hints = true,
			parameter_hints_prefix = "<- ",
			other_hints_prefix = "=> ",
			max_len_align = false,
			max_len_align_padding = 1,
			right_align = false,
			right_align_padding = 7,
			highlight = "Comment",
		},
		ast = {
			role_icons = {
				type = "",
				declaration = "",
				expression = "",
				specifier = "",
				statement = "",
				["template argument"] = "",
			},
			kind_icons = {
				Compound = "",
				Recovery = "",
				TranslationUnit = "",
				PackExpansion = "",
				TemplateTypeParm = "",
				TemplateTemplateParm = "",
				TemplateParamObject = "",
			},
		},
		memory_usage = {
			border = "rounded",
		},
		symbol_info = {
			border = "rounded",
		},
	},
	config = function(_, opts)
		require("clangd_extensions").setup(opts)

		-- Keybindings for clangd-specific features
		vim.keymap.set("n", "<leader>ch", "<cmd>ClangdSwitchSourceHeader<cr>", { desc = "Switch Source/Header" })
		vim.keymap.set("n", "<leader>ct", "<cmd>ClangdTypeHierarchy<cr>", { desc = "Type Hierarchy" })
		vim.keymap.set("n", "<leader>cs", "<cmd>ClangdSymbolInfo<cr>", { desc = "Symbol Info" })
		vim.keymap.set("n", "<leader>cm", "<cmd>ClangdMemoryUsage<cr>", { desc = "Memory Usage" })
	end,
}
