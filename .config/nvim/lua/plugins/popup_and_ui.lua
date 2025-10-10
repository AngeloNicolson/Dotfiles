return {
	-- Popup UI/Floating Window
	"MunifTanjim/nui.nvim",

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
					view = "mini", -- Use mini view for messages (bottom right corner)
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
