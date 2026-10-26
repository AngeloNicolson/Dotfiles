return {
	"neovim/nvim-lspconfig",
	event = { "BufReadPre", "BufNewFile" },
	dependencies = {
		"williamboman/mason.nvim",
		"williamboman/mason-lspconfig.nvim",
		"WhoIsSethDaniel/mason-tool-installer.nvim",
		"hrsh7th/cmp-nvim-lsp",
	},
	config = function()
		-- Diagnostics -----------------------------------------------------------
		vim.diagnostic.config({
			virtual_text = { prefix = "●", source = true, spacing = 4 },
			signs = {
				text = {
					[vim.diagnostic.severity.ERROR] = "",
					[vim.diagnostic.severity.WARN] = "",
					[vim.diagnostic.severity.INFO] = "",
					[vim.diagnostic.severity.HINT] = "",
				},
			},
			update_in_insert = false,
			underline = true,
			severity_sort = true,
			float = { focusable = false, style = "minimal", border = "rounded", source = true, header = "", prefix = "" },
		})

		-- Keymaps + per-buffer behaviour -----------------------------------------
		vim.api.nvim_create_autocmd("LspAttach", {
			group = vim.api.nvim_create_augroup("lsp-attach", { clear = true }),
			callback = function(event)
				local client = vim.lsp.get_client_by_id(event.data.client_id)
				if not client then
					return
				end
				-- Formatting is conform's job (clang-format/stylua/...), never the server's.
				client.server_capabilities.documentFormattingProvider = false
				client.server_capabilities.documentRangeFormattingProvider = false

				local map = function(keys, func, desc, mode)
					vim.keymap.set(mode or "n", keys, func, { buffer = event.buf, desc = "LSP: " .. desc })
				end
				local tb = function(fn)
					return function()
						require("telescope.builtin")[fn]()
					end
				end
				map("gd", tb("lsp_definitions"), "[G]oto [D]efinition")
				map("gr", tb("lsp_references"), "[G]oto [R]eferences")
				map("gI", tb("lsp_implementations"), "[G]oto [I]mplementation")
				map("<leader>ld", tb("lsp_type_definitions"), "Type [D]efinition")
				map("<leader>ls", tb("lsp_document_symbols"), "[D]ocument [S]ymbols")
				map("<leader>lS", tb("lsp_dynamic_workspace_symbols"), "[W]orkspace [S]ymbols")
				-- Signature help on demand (noice no longer auto-opens it)
				map("<C-k>", vim.lsp.buf.signature_help, "Signature help", { "i", "n" })
				map("<leader>lr", vim.lsp.buf.rename, "[R]ename")
				map("<leader>la", vim.lsp.buf.code_action, "Code [A]ction", { "n", "v" })
				map("K", vim.lsp.buf.hover, "Hover Documentation")
				map("gD", vim.lsp.buf.declaration, "[G]oto [D]eclaration")
				map("<leader>lwa", vim.lsp.buf.add_workspace_folder, "[W]orkspace [A]dd Folder")
				map("<leader>lwr", vim.lsp.buf.remove_workspace_folder, "[W]orkspace [R]emove Folder")
				map("<leader>lwl", function()
					print(vim.inspect(vim.lsp.buf.list_workspace_folders()))
				end, "[W]orkspace [L]ist Folders")

				if client:supports_method("textDocument/inlayHint") then
					vim.lsp.inlay_hint.enable(true, { bufnr = event.buf })
					map("<leader>li", function()
						local on = not vim.lsp.inlay_hint.is_enabled({ bufnr = event.buf })
						vim.lsp.inlay_hint.enable(on, { bufnr = event.buf })
						vim.notify("Inlay hints " .. (on and "on" or "off"), vim.log.levels.INFO)
					end, "Toggle [I]nlay hints")
				end

				if client:supports_method("textDocument/documentHighlight") then
					local grp = vim.api.nvim_create_augroup("lsp-highlight-" .. event.buf, { clear = true })
					vim.api.nvim_create_autocmd({ "CursorHold", "CursorHoldI" }, {
						group = grp,
						buffer = event.buf,
						callback = vim.lsp.buf.document_highlight,
					})
					vim.api.nvim_create_autocmd({ "CursorMoved", "CursorMovedI" }, {
						group = grp,
						buffer = event.buf,
						callback = vim.lsp.buf.clear_references,
					})
				end
			end,
		})

		-- Server configs (vim.lsp.config merges over nvim-lspconfig's lsp/*.lua) ---
		local capabilities = vim.tbl_deep_extend(
			"force",
			vim.lsp.protocol.make_client_capabilities(),
			require("cmp_nvim_lsp").default_capabilities()
		)
		vim.lsp.config("*", { capabilities = capabilities })

		local servers = {
			clangd = {
				cmd = {
					"clangd",
					"--background-index",
					"--clang-tidy",
					"--header-insertion=iwyu",
					"--completion-style=detailed",
					"--function-arg-placeholders",
					"--query-driver=/usr/bin/g++,/usr/bin/clang++,/opt/cuda/bin/nvcc",
				},
				filetypes = { "c", "cpp", "objc", "objcpp", "cuda", "proto" },
				root_markers = { "compile_commands.json", ".clangd", "CMakePresets.json", "CMakeLists.txt", ".git" },
				capabilities = { offsetEncoding = { "utf-16" } },
				init_options = { usePlaceholders = true, completeUnimported = true, clangdFileStatus = true },
			},
			glsl_analyzer = {
				filetypes = { "glsl", "vert", "frag", "geom", "comp", "tesc", "tese" },
				root_markers = { "compile_commands.json", "CMakePresets.json", "CMakeLists.txt", ".git" },
			},
			lua_ls = {
				settings = {
					Lua = {
						runtime = { version = "LuaJIT" },
						workspace = { checkThirdParty = false, library = { vim.env.VIMRUNTIME } },
						completion = { callSnippet = "Replace" },
						telemetry = { enable = false },
						diagnostics = { disable = { "missing-fields" } },
						hint = { enable = true },
					},
				},
			},
			pylsp = {
				settings = {
					pylsp = {
						plugins = {
							pyflakes = { enabled = false },
							pycodestyle = { enabled = false },
							autopep8 = { enabled = false },
							yapf = { enabled = false },
							mccabe = { enabled = false },
							pylsp_mypy = { enabled = false },
							pylsp_black = { enabled = false },
							pylsp_isort = { enabled = false },
						},
					},
				},
			},
			jdtls = { settings = { java = { format = { enabled = false } } } },
			clojure_lsp = {},
			rust_analyzer = {},
			ts_ls = {
				filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
				root_markers = { "package.json", "tsconfig.json", ".git" },
				workspace_required = true, -- was single_file_support = false
				settings = {
					typescript = {
						inlayHints = {
							includeInlayParameterNameHints = "all",
							includeInlayParameterNameHintsWhenArgumentMatchesName = false,
							includeInlayFunctionParameterTypeHints = true,
							includeInlayVariableTypeHints = true,
							includeInlayPropertyDeclarationTypeHints = true,
							includeInlayFunctionLikeReturnTypeHints = true,
							includeInlayEnumMemberValueHints = true,
						},
					},
					javascript = {
						inlayHints = {
							includeInlayParameterNameHints = "all",
							includeInlayParameterNameHintsWhenArgumentMatchesName = false,
							includeInlayFunctionParameterTypeHints = true,
							includeInlayVariableTypeHints = true,
							includeInlayPropertyDeclarationTypeHints = true,
							includeInlayFunctionLikeReturnTypeHints = true,
							includeInlayEnumMemberValueHints = true,
						},
					},
				},
			},
			bashls = {},
			dockerls = {},
			docker_compose_language_service = {},
			jsonls = {},
			sqlls = {},
			terraformls = {},
			yamlls = {},
		}

		for name, cfg in pairs(servers) do
			vim.lsp.config(name, cfg)
		end

		-- Mason only installs; enabling is ours (automatic_enable would also call
		-- vim.lsp.enable, which is harmless since vim.lsp.config above is what it reads).
		require("mason").setup()
		require("mason-tool-installer").setup({ ensure_installed = { "stylua", "eslint_d" } })
		require("mason-lspconfig").setup({
			ensure_installed = vim.tbl_keys(servers),
			automatic_enable = false,
		})
		vim.lsp.enable(vim.tbl_keys(servers))
	end,
}
