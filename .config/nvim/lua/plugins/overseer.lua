return {
	"stevearc/overseer.nvim",
	config = function()
		require("overseer").setup({
			strategy = {
				"toggleterm",
				direction = "horizontal",
				autos_croll = true,
				quit_on_exit = "success",
			},
			templates = { "builtin", "user.cpp_build" },
			task_list = {
				direction = "bottom",
				min_height = 25,
				max_height = 25,
				default_detail = 1,
				bindings = {
					["?"] = "ShowHelp",
					["g?"] = "ShowHelp",
					["<CR>"] = "RunAction",
					["<C-e>"] = "Edit",
					["o"] = "Open",
					["<C-v>"] = "OpenVsplit",
					["<C-s>"] = "OpenSplit",
					["<C-f>"] = "OpenFloat",
					["<C-q>"] = "OpenQuickFix",
					["p"] = "TogglePreview",
					["<C-l>"] = "IncreaseDetail",
					["<C-h>"] = "DecreaseDetail",
					["L"] = "IncreaseAllDetail",
					["H"] = "DecreaseAllDetail",
					["["] = "DecreaseWidth",
					["]"] = "IncreaseWidth",
					["{"] = "PrevTask",
					["}"] = "NextTask",
					["<C-k>"] = "ScrollOutputUp",
					["<C-j>"] = "ScrollOutputDown",
					["q"] = "Close",
				},
			},
			form = {
				border = "rounded",
				win_opts = {
					winblend = 0,
				},
			},
			confirm = {
				border = "rounded",
				win_opts = {
					winblend = 0,
				},
			},
			task_win = {
				border = "rounded",
				win_opts = {
					winblend = 0,
				},
			},
		})

		-- Keybindings
		vim.keymap.set("n", "<leader>ot", "<cmd>OverseerToggle<cr>", { desc = "Toggle Overseer" })
		vim.keymap.set("n", "<leader>or", "<cmd>OverseerRun<cr>", { desc = "Run Task" })
		vim.keymap.set("n", "<leader>ob", "<cmd>OverseerBuild<cr>", { desc = "Build Task" })
		vim.keymap.set("n", "<leader>oq", "<cmd>OverseerQuickAction<cr>", { desc = "Quick Action" })
		vim.keymap.set("n", "<leader>oa", "<cmd>OverseerTaskAction<cr>", { desc = "Task Action" })
	end,
}
