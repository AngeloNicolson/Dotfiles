return {
	"p00f/clangd_extensions.nvim",
	-- Prefix ownership: <leader>lc (Language -> Clangd). Inlay hints are native
	-- now (vim.lsp.inlay_hint, enabled in plugins/lsp.lua, toggle <leader>li).
	dependencies = { "neovim/nvim-lspconfig" },
	ft = { "c", "cpp", "objc", "objcpp", "cuda", "proto" },
	opts = {
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
		memory_usage = { border = "rounded" },
		symbol_info = { border = "rounded" },
	},
	config = function(_, opts)
		require("clangd_extensions").setup(opts)
		vim.keymap.set("n", "<leader>lch", "<cmd>LspClangdSwitchSourceHeader<cr>", { desc = "Clangd switch source/header" })
		vim.keymap.set("n", "<leader>lca", "<cmd>ClangdAST<cr>", { desc = "Clangd AST" })
		vim.keymap.set("n", "<leader>lct", "<cmd>ClangdTypeHierarchy<cr>", { desc = "Clangd type hierarchy" })
		vim.keymap.set("n", "<leader>lcs", "<cmd>ClangdSymbolInfo<cr>", { desc = "Clangd symbol info" })
		vim.keymap.set("n", "<leader>lcm", "<cmd>ClangdMemoryUsage<cr>", { desc = "Clangd memory usage" })
	end,
}
