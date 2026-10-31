return {
	-- System theme sync
	-- Gruvbox Material theme (backup fallback)
	{
		"sainnhe/gruvbox-material",
		lazy = true,
		priority = 999,
	},

	-- System-synced colorscheme loader.
	-- The active theme is ~/.config/themes/.current (written by AGS when you
	-- pick a theme). Themes with a hand-made scheme use it; everything else
	-- uses colors/system.lua, which builds the scheme from the theme's JSON
	-- palette. A watcher on the themes dir reloads live when .current changes.
	{
		name = "system-theme-sync",
		dir = vim.fn.stdpath("config") .. "/colors",
		lazy = false,
		priority = 1000,
		config = function()
			-- Enable termguicolors for true color support
			vim.o.termguicolors = true

			local THEME_DIR = os.getenv("HOME") .. "/.config/themes"

			-- Function to read current system theme
			local function get_system_theme()
				local file = io.open(THEME_DIR .. "/.current", "r")
				if file then
					local theme = file:read("*line")
					file:close()
					if theme and theme ~= "" then
						return vim.trim(theme)
					end
				end
				return "mech" -- Default fallback
			end

			-- Hand-made schemes; anything not listed → palette-driven "system".
			local colorscheme_map = {
				halo = "halo",
			}

			-- Clear the background of the main groups, keeping their fg/attrs
			-- (nvim_set_hl replaces the whole definition).
			local function apply_transparency()
				for _, group in ipairs({
					"Normal", "NormalNC", "NormalFloat", "FloatBorder",
					"SignColumn", "EndOfBuffer", "LineNr", "FoldColumn",
				}) do
					local hl = vim.api.nvim_get_hl(0, { name = group, link = false })
					hl.bg, hl.ctermbg = nil, nil
					hl.bg = "none"
					vim.api.nvim_set_hl(0, group, hl)
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
				local ok = pcall(vim.cmd, "colorscheme " .. scheme)
				if not ok then
					vim.cmd("colorscheme system")
				end
				vim.cmd("highlight Comment cterm=italic gui=italic")
				vim.cmd("highlight Function cterm=bold gui=bold")
				apply_transparency()
				neutralize_semantic_tokens()
				vim.api.nvim_set_hl(0, "CursorLine", { bg = "#000000" })
				vim.api.nvim_set_hl(0, "CursorLineNr", { bg = "#000000", bold = true })
			end

			local loaded_theme = nil
			local function load_system_theme(force)
				local theme = get_system_theme()
				if theme == loaded_theme and not force then
					return false
				end
				loaded_theme = theme
				load_scheme(colorscheme_map[theme] or "system")
				return true
			end

			load_system_theme(true)

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
				load_system_theme(true)
				print("Loaded " .. vim.g.colors_name .. " for system theme " .. tostring(loaded_theme))
			end, {})

			-- Live reload: watch the themes dir (AGS rewrites .current on a theme
			-- change; watching the dir also catches a replace-by-rename).
			local uv = vim.uv or vim.loop
			local watcher = uv.new_fs_event()
			local pending = nil
			if watcher then
				watcher:start(THEME_DIR, {}, function(_, fname)
					if fname and fname ~= ".current" then
						return
					end
					if pending then
						pending:stop()
						pending:close()
					end
					pending = uv.new_timer()
					pending:start(150, 0, function()
						pending:stop()
						pending:close()
						pending = nil
						vim.schedule(function()
							if load_system_theme(false) then
								vim.notify("theme: " .. tostring(loaded_theme), vim.log.levels.INFO, { title = "System theme" })
							end
						end)
					end)
				end)
				vim.api.nvim_create_autocmd("VimLeavePre", {
					callback = function()
						watcher:stop()
					end,
				})
			end
		end,
	},
}
