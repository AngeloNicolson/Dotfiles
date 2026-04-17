return {
	{
		"folke/todo-comments.nvim",
		-- Prefix ownership: <leader>x (Diagnostics/Todos)
		event = "VeryLazy",
		dependencies = { "nvim-lua/plenary.nvim", "folke/trouble.nvim" },
		init = function()
			if vim.fn.executable("rg") == 0 then
				vim.notify(
					"todo-comments: `ripgrep` not found — :TodoTrouble/:TodoTelescope will return no results. Install with `pacman -S ripgrep`.",
					vim.log.levels.WARN
				)
			end
		end,
		opts = {
			signs = true,
			highlight = {
				pattern = [[.*<(KEYWORDS)\s*:]],
				keyword = "wide",
				after = "fg",
			},
			search = {
				pattern = [[\b(KEYWORDS):]],
			},
		},
		keys = {
			{
				"]t",
				function() require("todo-comments").jump_next() end,
				desc = "Next todo comment",
			},
			{
				"[t",
				function() require("todo-comments").jump_prev() end,
				desc = "Previous todo comment",
			},
			{ "<leader>xt", "<cmd>Trouble todo toggle focus=true<cr>", desc = "Todo (Trouble)" },
			{ "<leader>xT", "<cmd>TodoTelescope<cr>", desc = "Todo (Telescope)" },
		},
	},
	{
		"folke/trouble.nvim",
		-- Prefix ownership: <leader>x (Diagnostics)
		cmd = "Trouble",
		opts = {},
		keys = {
			{ "<leader>xx", "<cmd>Trouble diagnostics toggle<cr>", desc = "Diagnostics (Trouble)" },
			{ "<leader>xX", "<cmd>Trouble diagnostics toggle filter.buf=0<cr>", desc = "Buffer Diagnostics (Trouble)" },
			{ "<leader>xl", "<cmd>Trouble loclist toggle<cr>", desc = "Location List (Trouble)" },
			{ "<leader>xq", "<cmd>Trouble qflist toggle<cr>", desc = "Quickfix List (Trouble)" },
			{ "<leader>xs", "<cmd>Trouble symbols toggle focus=false<cr>", desc = "Symbols (Trouble)" },
		},
	},
}
