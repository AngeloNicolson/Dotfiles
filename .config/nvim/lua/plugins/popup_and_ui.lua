return {
	-- Popup UI/Floating Window
	"MunifTanjim/nui.nvim",

	-- Fidget for inline notifications
	{
		"j-hui/fidget.nvim",
		event = "LspAttach",
		config = function()
			require("fidget").setup({
				notification = {
					override_vim_notify = false,
					window = {
						winblend = 0,
						align = "bottom",
					},
				},
			})
		end,
	},

	-- Noice for enhanced UI
	{
		"folke/noice.nvim",
		event = "VeryLazy",
		dependencies = { "MunifTanjim/nui.nvim", "rcarriga/nvim-notify" },
		config = function()
			require("noice").setup({
				cmdline = {
					enabled = true,
					view = "cmdline_popup",
				},
				messages = {
					enabled = true,
					view = "mini",
					view_error = "notify",
					view_warn = "notify",
				},
				notify = {
					enabled = true,
					view = "notify",
				},
				lsp = {
					-- noice auto-opens signature help on every "(" and ","; with clangd
					-- that is a full doc comment fighting the completion menu. Manual
					-- only: <C-k> (insert or normal) shows it, capped in height.
					signature = {
						enabled = true,
						auto_open = { enabled = false },
						opts = { size = { max_height = 12, max_width = 100 } },
					},
					hover = { opts = { size = { max_height = 20, max_width = 100 } } },
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
