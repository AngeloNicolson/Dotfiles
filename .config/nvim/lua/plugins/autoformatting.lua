return {
	{
		"stevearc/conform.nvim",
		event = { "BufReadPre", "BufNewFile" },
		config = function()
			local conform = require("conform")
			local clang_format_config = vim.fn.stdpath("config") .. "/format_configs/.clang-format"

			conform.setup({
				formatters_by_ft = {
					lua = { "stylua" },
					python = { "black" },
					c = { "clang_format" },
					cpp = { "clang_format" },
					h = { "clang_format" },
					hpp = { "clang_format" },
					java = { "astyle" },
					markdown = { "mdformat" },
					css = { "prettierd" },
					javascript = { "prettierd" },
					typescript = { "prettierd" },
					javascriptreact = { "prettierd" },
					typescriptreact = { "prettierd" },
					json = { "prettierd" },
					html = { "prettierd" },
					scss = { "prettierd" },
					less = { "prettierd" },
				},
				format_on_save = function(bufnr)
					if vim.g.disable_autoformat or vim.b[bufnr].disable_autoformat then
						return
					end

					return {
						timeout_ms = 1500,
						lsp_format = "fallback",
						quiet = true,
					}
				end,
				formatters = {
					black = {
						prepend_args = { "--line-length", "80" },
					},
					clang_format = {
						prepend_args = function(_, ctx)
							local project_style = vim.fs.find(
								{ ".clang-format", "_clang-format" },
								{ path = ctx.filename, upward = true }
							)[1]

							if project_style then
								return {}
							end

							return {
								"--style=file:" .. clang_format_config,
								"--fallback-style=LLVM",
							}
						end,
					},
					astyle = {
						prepend_args = {
							"--style=allman",
							"--mode=java",
							"--indent=spaces=4",
							"--pad-oper",
							"--suffix=none",
						},
					},
					mdformat = {
						prepend_args = { "--wrap", "77" },
					},
					prettierd = {
						prepend_args = {
							"--no-semi",
							"--double-quote",
							"--jsx-single-quote",
							"--bracket-same-line",
						},
					},
				},
			})

			vim.keymap.set("n", "<leader>lf", function()
				conform.format({
					async = false,
					lsp_format = "fallback",
				})
			end, { desc = "LSP: format buffer" })

			vim.api.nvim_create_user_command("Format", function()
				conform.format({
					async = false,
					lsp_format = "fallback",
				})
			end, { desc = "Format current buffer" })

			vim.api.nvim_create_user_command("Wf", function()
				vim.cmd("write")
			end, { desc = "Format and save buffer" })
		end,
	},
	{
		"nvimtools/none-ls.nvim",
		dependencies = {
			"nvimtools/none-ls-extras.nvim",
		},
		config = function()
			require("null-ls").setup({
				sources = {},
			})
		end,
	},
}
