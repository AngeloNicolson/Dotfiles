return {
	"stevearc/overseer.nvim",
	-- Prefix ownership: <leader>bo (Build -> Overseer)
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
		vim.keymap.set("n", "<leader>bot", "<cmd>OverseerToggle<cr>", { desc = "Overseer toggle" })
		vim.keymap.set("n", "<leader>bor", "<cmd>OverseerRun<cr>", { desc = "Overseer run task" })
		vim.keymap.set("n", "<leader>bob", "<cmd>OverseerBuild<cr>", { desc = "Overseer build task" })
		vim.keymap.set("n", "<leader>boq", "<cmd>OverseerQuickAction<cr>", { desc = "Overseer quick action" })
		vim.keymap.set("n", "<leader>boa", "<cmd>OverseerTaskAction<cr>", { desc = "Overseer task action" })
	end,
}
