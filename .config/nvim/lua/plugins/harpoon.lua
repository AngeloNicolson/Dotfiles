return {
	{
		"ThePrimeagen/harpoon",
		branch = "harpoon2",
		dependencies = { "nvim-lua/plenary.nvim" },
		config = function()
			local harpoon = require("harpoon")
			harpoon:setup()

			-- Keybinds
			vim.keymap.set("n", "<leader>a", function()
				harpoon:list():add()
			end, { desc = "Harpoon: Add file" })

			vim.keymap.set("n", "<C-e>", function()
				harpoon.ui:toggle_quick_menu(harpoon:list())
			end, { desc = "Harpoon: Toggle menu" })

			-- Navigate to files
			vim.keymap.set("n", "<C-h>", function()
				harpoon:list():select(1)
			end, { desc = "Harpoon: File 1" })

			vim.keymap.set("n", "<C-j>", function()
				harpoon:list():select(2)
			end, { desc = "Harpoon: File 2" })

			vim.keymap.set("n", "<C-k>", function()
				harpoon:list():select(3)
			end, { desc = "Harpoon: File 3" })

			vim.keymap.set("n", "<C-l>", function()
				harpoon:list():select(4)
			end, { desc = "Harpoon: File 4" })

			-- Toggle previous & next buffers
			vim.keymap.set("n", "<C-S-P>", function()
				harpoon:list():prev()
			end, { desc = "Harpoon: Previous" })

			vim.keymap.set("n", "<C-S-N>", function()
				harpoon:list():next()
			end, { desc = "Harpoon: Next" })
		end,
	},
}
