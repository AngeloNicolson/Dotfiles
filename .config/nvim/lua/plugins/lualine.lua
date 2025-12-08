return {
	-- Status Line
	{

		"nvim-lualine/lualine.nvim",

		dependencies = { "nvim-tree/nvim-web-devicons" },

		config = function()
			local status_ok_lualine, lualine = pcall(require, "lualine")

			if not status_ok_lualine then
				return
			end

			-- Optionally, you can define your sections if needed
			-- local noirbuddy_lualine = require("noirbuddy.plugins.lualine")
			-- local theme = noirbuddy_lualine.theme
			-- local sections = noirbuddy_lualine.sections
			-- local inactive_sections = noirbuddy_lualine.inactive_sections

			lualine.setup({
				options = {
					icons_enabled = true,
					theme = "gruvbox-material",
					component_separators = { left = "", right = "" },
					section_separators = { left = "", right = "" },
					disabled_filetypes = { statusline = { "dashboard", "alpha" } },
					always_divide_middle = true,
					globalstatus = true, -- Single statusline for all windows
				},
				sections = {
					lualine_a = { "mode" },
					lualine_b = { "branch", "diff", "diagnostics" },
					lualine_c = {
						{
							"filename",
							path = 1, -- Show relative path
							symbols = { modified = " ", readonly = " ", unnamed = "[No Name]" },
						},
					},
					lualine_x = {
						{
							require("lazy.status").updates,
							cond = require("lazy.status").has_updates,
							color = { fg = "#ff9e64" },
						},
						{ "encoding", show_bomb = true },
						"fileformat",
						"filetype",
					},
					lualine_y = { "progress" },
					lualine_z = { "location" },
				},
				inactive_sections = {
					lualine_a = {},
					lualine_b = {},
					lualine_c = { "filename" },
					lualine_x = { "location" },
					lualine_y = {},
					lualine_z = {},
				},
			})
		end,
	},
}
