return {
	{
		"goolord/alpha-nvim",
		dependencies = { "nvim-tree/nvim-web-devicons" },
		config = function()
			local alpha = require("alpha")

			-- Read logo from file
			local logo_path = os.getenv("HOME") .. "/.config/kondor-logo.txt"
			local logo_lines = {}
			local file = io.open(logo_path, "r")
			if file then
				for line in file:lines() do
					table.insert(logo_lines, line)
				end
				file:close()
			else
				logo_lines = { "KONDOR SYSTEMS" }
			end

			local header = {
				type = "text",
				val = logo_lines,
				opts = {
					position = "center",
					hl = "KondorLogo",
				},
			}

			local buttons = {
				type = "group",
				val = {
					{ type = "padding", val = 2 },
					{
						type = "button",
						val = "  Find file",
						on_press = function() vim.cmd("Telescope find_files") end,
						opts = { shortcut = "f", position = "center", cursor = 3, width = 30, align_shortcut = "right", hl_shortcut = "Keyword" },
					},
					{
						type = "button",
						val = "  Recent files",
						on_press = function() vim.cmd("Telescope oldfiles") end,
						opts = { shortcut = "r", position = "center", cursor = 3, width = 30, align_shortcut = "right", hl_shortcut = "Keyword" },
					},
					{
						type = "button",
						val = "  Grep search",
						on_press = function() vim.cmd("Telescope live_grep") end,
						opts = { shortcut = "g", position = "center", cursor = 3, width = 30, align_shortcut = "right", hl_shortcut = "Keyword" },
					},
					{
						type = "button",
						val = "  Quit",
						on_press = function() vim.cmd("qa") end,
						opts = { shortcut = "q", position = "center", cursor = 3, width = 30, align_shortcut = "right", hl_shortcut = "Keyword" },
					},
				},
			}

			local config = {
				layout = {
					{ type = "padding", val = 2 },
					header,
					buttons,
				},
			}

			alpha.setup(config)

			-- Keymaps for dashboard buttons
			vim.api.nvim_create_autocmd("FileType", {
				pattern = "alpha",
				callback = function()
					local buf = vim.api.nvim_get_current_buf()
					vim.keymap.set("n", "f", "<cmd>Telescope find_files<cr>", { buffer = buf })
					vim.keymap.set("n", "r", "<cmd>Telescope oldfiles<cr>", { buffer = buf })
					vim.keymap.set("n", "g", "<cmd>Telescope live_grep<cr>", { buffer = buf })
					vim.keymap.set("n", "q", "<cmd>qa<cr>", { buffer = buf })
				end,
			})
		end,
	},
}
