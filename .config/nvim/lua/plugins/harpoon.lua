return {
	{
		"ThePrimeagen/harpoon",
		-- Prefix ownership: <leader>fj (Files -> Jump), plus <C-e>/<C-j>/<C-k>
		branch = "harpoon2",
		dependencies = { "nvim-lua/plenary.nvim" },
		config = function()
			local harpoon = require("harpoon")
			harpoon:setup()

			-- Keybinds
			vim.keymap.set("n", "<leader>fja", function()
				harpoon:list():add()
			end, { desc = "Files jump add" })

			vim.keymap.set("n", "<leader>fjm", function()
				harpoon.ui:toggle_quick_menu(harpoon:list())
			end, { desc = "Files jump menu" })

			vim.keymap.set("n", "<C-e>", function()
				harpoon.ui:toggle_quick_menu(harpoon:list())
			end, { desc = "Harpoon: Toggle menu" })

			-- Cycle through harpoon list
			vim.keymap.set("n", "<C-k>", function()
				harpoon:list():prev()
			end, { desc = "Harpoon: Previous" })

			vim.keymap.set("n", "<C-j>", function()
				harpoon:list():next()
			end, { desc = "Harpoon: Next" })
		end,
	},
}
