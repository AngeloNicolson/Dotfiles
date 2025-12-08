return {
	"nvimtools/none-ls.nvim",
	dependencies = {
		"nvimtools/none-ls-extras.nvim",
		"jayp0521/mason-null-ls.nvim",
	},
	config = function()
		local null_ls = require("null-ls")
		local formatting = null_ls.builtins.formatting

		-- Install formatters manually via :Mason when needed
		-- Automatic installation disabled to prevent startup conflicts
		require("mason-null-ls").setup({
			-- ensure_installed = {
			-- 	"stylua",
			-- 	"black",
			-- 	"prettierd",
			-- 	"clang-format",
			-- },
			automatic_installation = false,
		})

		local sources = {
			formatting.stylua,
			formatting.black.with({
				extra_args = { "--line-length=80" },
				filetypes = { "python" },
			}),
			formatting.clang_format.with({
				extra_args = {
					"--style=file:/home/Angel/.config/nvim/format_configs/.clang-format",
					"--verbose",
				},
				filetypes = { "c", "cpp", "h", "hpp" },
			}),
			-- Java formatting with astyle (Global formatter)
			formatting.astyle.with({
				extra_args = {
					"--style=allman",
					"--mode=java",
					"--indent=spaces=4",
					"--pad-oper",
					"--suffix=none",
				},
				filetypes = { "java" },
			}),
			formatting.mdformat.with({
				extra_args = { "--wrap", "77" },
				filetypes = { "markdown" },
			}),
			formatting.prettierd.with({
				extra_args = {
					"--no-semi",
					"--double-quote",
					"--jsx-single-quote",
					"--bracket-same-line",
				},
				filetypes = {
					"css",
					"javascript",
					"typescript",
					"javascriptreact",
					"typescriptreact",
					"json",
					"html",
					"scss",
					"less",
					"js",
					"jsx",
				},
			}),
		}

		null_ls.setup({
			sources = sources,
			on_attach = function(client, bufnr)
				if client.server_capabilities.documentFormattingProvider then
					vim.api.nvim_buf_create_user_command(bufnr, "Wf", function()
						vim.lsp.buf.format({
							async = false,
							filter = function(c)
								return c.name == "null-ls"
							end,
						})
						vim.api.nvim_buf_call(bufnr, function()
							vim.cmd("write")
						end)
					end, { desc = "Format and save buffer" })
				end
			end,
		})
	end,
}
