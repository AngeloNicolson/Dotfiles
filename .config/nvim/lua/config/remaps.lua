vim.g.mapleader = " "

-- Global/editor mappings only. Plugin-specific mappings live with plugin configs.

-- File/open mappings
vim.keymap.set("n", "<leader>fx", vim.cmd.Ex, { desc = "Files netrw explorer" })

-- Allows moving of highlighted text up and down
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")

-- when half page scrolling the cursor stays in the middle
vim.keymap.set("n", "<C-d>", "<C-d>zz")
vim.keymap.set("n", "<C-u>", "<C-u>zz")

-- Search terms to stay in the middle
vim.keymap.set("n", "n", "nzzzv")
vim.keymap.set("n", "N", "Nzzzv")

-- Clipboard group
vim.keymap.set("n", "<leader>cy", '"+y', { desc = "Clipboard yank" })
vim.keymap.set("v", "<leader>cy", '"+y', { desc = "Clipboard yank" })
vim.keymap.set("n", "<leader>cY", '"+Y', { desc = "Clipboard yank line" })
vim.keymap.set("n", "<leader>cp", '"+p', { desc = "Clipboard paste after" })
vim.keymap.set("n", "<leader>cP", '"+P', { desc = "Clipboard paste before" })
vim.keymap.set("v", "<leader>cp", '"+p', { desc = "Clipboard paste after" })
vim.keymap.set("v", "<leader>cP", '"+P', { desc = "Clipboard paste before" })

-- Map <leader>l to act as <C-w>
vim.keymap.set("n", "<leader>w", "<C-w>")


vim.keymap.set("n", "<leader>hk", "<cmd>Telescope keymaps<CR>", { desc = "Help keymaps" })
vim.keymap.set("n", "<leader>hc", "<cmd>Telescope commands<CR>", { desc = "Help commands" })
vim.keymap.set("n", "<leader>hh", "<cmd>Telescope help_tags<CR>", { desc = "Help tags" })
vim.keymap.set("n", "<leader>he", "<cmd>Noice errors<CR>", { desc = "Help error history" })
vim.keymap.set("n", "<leader>hm", "<cmd>Noice history<CR>", { desc = "Help message history" })
vim.keymap.set("n", "<leader>hb", function()
	require("which-key").show({ global = false })
end, { desc = "Help buffer keymaps" })

vim.keymap.set("n", "<leader>am", "<cmd>AIModels<CR>", { desc = "AI model select" })
vim.keymap.set("n", "<leader>a?", "<cmd>AIModels<CR>", { desc = "AI model select" })
