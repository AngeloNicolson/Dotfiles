return {
	"rgroli/other.nvim",
	config = function()
		require("other-nvim").setup({
			mappings = {
				-- C/C++ mappings
				{
					pattern = "/(.*)%.cpp$",
					target = "/%1.h",
					context = "header",
				},
				{
					pattern = "/(.*)%.c$",
					target = "/%1.h",
					context = "header",
				},
				{
					pattern = "/(.*)%.h$",
					target = {
						{ target = "/%1.cpp", context = "implementation" },
						{ target = "/%1.c", context = "implementation" },
					},
				},
				-- Header variants (.hpp, .hh)
				{
					pattern = "/(.*)%.cpp$",
					target = {
						{ target = "/%1.h", context = "header" },
						{ target = "/%1.hpp", context = "header" },
						{ target = "/%1.hh", context = "header" },
					},
				},
				{
					pattern = "/(.*)%.hpp$",
					target = "/%1.cpp",
					context = "implementation",
				},
				{
					pattern = "/(.*)%.hh$",
					target = "/%1.cpp",
					context = "implementation",
				},
				-- Test files
				{
					pattern = "/src/(.*)%.cpp$",
					target = "/test/%1_test.cpp",
					context = "test",
				},
				{
					pattern = "/test/(.*)_test%.cpp$",
					target = "/src/%1.cpp",
					context = "source",
				},
			},
			style = {
				border = "rounded",
				seperator = "|",
				width = 0.7,
				minHeight = 2,
			},
		})

		-- Keybindings
		vim.keymap.set("n", "<leader>oo", "<cmd>Other<cr>", { desc = "Open related file" })
		vim.keymap.set("n", "<leader>oh", "<cmd>OtherSplit<cr>", { desc = "Open related file (split)" })
		vim.keymap.set("n", "<leader>ov", "<cmd>OtherVSplit<cr>", { desc = "Open related file (vsplit)" })
		vim.keymap.set("n", "<leader>oc", "<cmd>OtherClear<cr>", { desc = "Clear other.nvim cache" })
	end,
}
