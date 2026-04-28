return {
	-- System theme sync
	-- Gruvbox Material theme (backup fallback)
	{
		"sainnhe/gruvbox-material",
		lazy = true,
		priority = 999,
	},

	{
		"kdheepak/monochrome.nvim",
		lazy = true,
		priority = 999,
	},

	{
		"xero/miasma.nvim",
		lazy = true,
		priority = 999,
	},

	-- System-synced colorscheme loader
	{
		name = "system-theme-sync",
		dir = vim.fn.stdpath("config") .. "/colors",
		lazy = false,
		priority = 1000,
		config = function()
			-- Enable termguicolors for true color support
			vim.o.termguicolors = true

			-- Function to read current system theme
			local function get_system_theme()
				local theme_file = os.getenv("HOME") .. "/.config/themes/.current"
				local file = io.open(theme_file, "r")
				if file then
					local theme = file:read("*line")
					file:close()
					return theme
				end
				return "mech" -- Default fallback
			end

			-- Load the matching colorscheme
			local system_theme = get_system_theme()
			local colorscheme_map = {
				mech = "mech",
				famicom = "famicom",
				["e-ink"] = "monochrome",
				miasma = "miasma",
			}

			local function apply_transparency()
				for _, group in ipairs({
					"Normal", "NormalNC", "NormalFloat", "FloatBorder",
					"SignColumn", "EndOfBuffer", "LineNr", "FoldColumn",
				}) do
					vim.api.nvim_set_hl(0, group, { bg = "none" })
				end
			end

			local function neutralize_semantic_tokens()
				if vim.g.colors_name ~= "monochrome" then return end
				local off_white = "#f0f0f0"
				for _, group in ipairs({
					"@lsp.type.variable", "@lsp.type.parameter",
					"@lsp.type.property", "@lsp.type.member",
					"@lsp.type.enumMember", "@lsp.type.namespace",
					"@lsp.type.field", "@lsp.type.class",
					"@lsp.type.struct", "@lsp.type.enum",
					"@lsp.type.type", "@lsp.type.interface",
					"@lsp.type.typeParameter", "@lsp.type.macro",
					"@lsp.typemod.variable.readonly",
					"@lsp.typemod.parameter.readonly",
					"@variable", "@variable.parameter", "@variable.member",
					"@parameter", "@property", "@field",
					"@type", "@type.builtin", "@type.qualifier",
					"@namespace", "@module",
					"Identifier", "Type", "Structure",
					"Function", "@function", "@function.call",
					"@function.method", "@function.method.call",
					"@function.builtin", "@method", "@method.call",
					"TSFunction", "TSMethod",
					"DiagnosticHint", "DiagnosticInfo",
				}) do
					vim.api.nvim_set_hl(0, group, { fg = off_white })
				end
			end

			local function load_scheme(scheme)
				if scheme == "monochrome" then
					vim.g.monochrome_style = "custom"
					vim.g.monochrome_custom_style = { "#f5f5f5", "#5a5a5a" }
				end
				vim.cmd("colorscheme " .. scheme)
				vim.cmd("highlight Comment cterm=italic gui=italic")
				vim.cmd("highlight Function cterm=bold gui=bold")
				apply_transparency()
				neutralize_semantic_tokens()
				vim.api.nvim_set_hl(0, "CursorLine", { bg = "#000000" })
				vim.api.nvim_set_hl(0, "CursorLineNr", { bg = "#000000", bold = true })
			end

			load_scheme(colorscheme_map[system_theme] or "mech")

			vim.api.nvim_create_autocmd("ColorScheme", {
				callback = function()
					apply_transparency()
					neutralize_semantic_tokens()
					vim.api.nvim_set_hl(0, "CursorLine", { bg = "#000000" })
					vim.api.nvim_set_hl(0, "CursorLineNr", { bg = "#000000", bold = true })
				end,
			})

			vim.api.nvim_create_autocmd("LspAttach", {
				callback = neutralize_semantic_tokens,
			})

			vim.api.nvim_create_user_command("ReloadSystemTheme", function()
				local theme = get_system_theme()
				local scheme = colorscheme_map[theme] or "mech"
				load_scheme(scheme)
				print("Loaded " .. scheme .. " theme")
			end, {})
		end,
	},
}
