return {
	-- System theme sync
	-- Gruvbox Material theme (backup fallback)
	{
		"sainnhe/gruvbox-material",
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
				["e-ink"] = "e-ink",
			}

			local colorscheme = colorscheme_map[system_theme] or "mech"
			vim.cmd("colorscheme " .. colorscheme)

			-- Enable bold and italics
			vim.cmd("highlight Comment cterm=italic gui=italic")
			vim.cmd("highlight Function cterm=bold gui=bold")

			-- Create a command to reload theme from system
			vim.api.nvim_create_user_command("ReloadSystemTheme", function()
				local theme = get_system_theme()
				local scheme = colorscheme_map[theme] or "mech"
				vim.cmd("colorscheme " .. scheme)
				print("Loaded " .. scheme .. " theme")
			end, {})
		end,
	},
}
