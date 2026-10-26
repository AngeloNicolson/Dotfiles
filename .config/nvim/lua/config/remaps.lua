vim.g.mapleader = " "
vim.g.maplocalleader = ","

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

vim.keymap.set("n", "<leader>bx", function()
	local file = vim.fn.expand("%:p")
	local dir = vim.fn.expand("%:p:h")
	local output = vim.fn.expand("%:p:r")
	local ext = vim.fn.expand("%:e")

	if ext ~= "c" and ext ~= "cpp" and ext ~= "cc" and ext ~= "cxx" then
		vim.notify("Build/run supports C and C++ files", vim.log.levels.WARN)
		return
	end

	local compiler = ext == "c" and "gcc" or "g++"
	local command = string.format(
		"cd %s && %s -g -O0 -fopenmp %s -o %s && %s",
		vim.fn.shellescape(dir),
		compiler,
		vim.fn.shellescape(file),
		vim.fn.shellescape(output),
		vim.fn.shellescape(output)
	)

	vim.cmd("botright split")
	vim.cmd("resize 12")
	vim.cmd("terminal " .. command)
	vim.bo.buflisted = false
	vim.bo.bufhidden = "wipe"
	vim.keymap.set("n", "q", "<cmd>bd!<CR>", { buffer = true, desc = "Close build output" })
end, { desc = "Build/run current C/C++ file" })

-- <leader>w is the Windows/appearance group (ccc colour picker, undotree);
-- native <C-w> stays the window-command prefix.

vim.keymap.set("n", "<leader>hk", "<cmd>Telescope keymaps<CR>", { desc = "Help keymaps" })
vim.keymap.set("n", "<leader>hc", "<cmd>Telescope commands<CR>", { desc = "Help commands" })
vim.keymap.set("n", "<leader>hh", "<cmd>Telescope help_tags<CR>", { desc = "Help tags" })
vim.keymap.set("n", "<leader>he", "<cmd>Noice errors<CR>", { desc = "Help error history" })
vim.keymap.set("n", "<leader>hm", "<cmd>Noice history<CR>", { desc = "Help message history" })
-- <leader>hb (buffer keymaps) lives in plugins/init.lua with which-key.

vim.keymap.set("n", "<leader>am", "<cmd>AIModels<CR>", { desc = "AI model select (CodeCompanion)" })
