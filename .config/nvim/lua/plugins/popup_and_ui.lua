return {
	-- Popup UI/Floating Window
	"MunifTanjim/nui.nvim",

	-- nvim-notify for notifications
	{
		"rcarriga/nvim-notify",
		config = function()
			require("notify").setup({
				stages = "fade_in_slide_out",
				timeout = 2000,
				background_colour = "#000000",
				position = "bottom_right",
				max_width = 50,
			})
			vim.notify = require("notify")
		end,
	},

	-- Noice for enhanced UI
	{
		"folke/noice.nvim",
		dependencies = { "rcarriga/nvim-notify" },
		config = function()
			require("noice").setup({
				cmdline = {
					enabled = true,
					view = "cmdline_popup",
				},
				messages = {
					enabled = true,
					view = "notify", -- Use notify for nice notification popups
					view_error = "notify",
					view_warn = "notify",
				},
				notify = {
					enabled = true,
					view = "notify",
				},
				-- Views for cmdline popup and popup menu
				views = {
					-- Cmdline popup configuration
					cmdline_popup = {
						position = {
							row = "50%",
							col = "50%",
						},
						size = {
							width = 60,
							height = "auto",
						},
					},

					-- Popup menu configuration
					popupmenu = {
						relative = "editor",
						position = {
							row = 8,
							col = "50%",
						},
						size = {
							width = 60,
							height = 10,
						},
						border = {
							style = "rounded",
							padding = { 0, 1 },
						},
						win_options = {
							winhighlight = { Normal = "Normal", FloatBorder = "DiagnosticInfo" },
						},
					},

					-- Mini view for messages (bottom right, compact)
					mini = {
						backend = "mini",
						relative = "editor",
						align = "message-right",
						timeout = 2000,
						reverse = true,
						focusable = false,
						position = {
							row = -2,
							col = "100%",
						},
						size = "auto",
						border = {
							style = "none",
						},
						zindex = 60,
						win_options = {
							winblend = 0,
							winhighlight = {
								Normal = "NoiceMini",
								IncSearch = "",
								CurSearch = "",
								Search = "",
							},
						},
					},
				},
				routes = {
					{
						filter = {
							event = "msg_show",
							kind = "",
							find = "written",
						},
						opts = { skip = true },
					},
				},
			})
		end,
	},
}
