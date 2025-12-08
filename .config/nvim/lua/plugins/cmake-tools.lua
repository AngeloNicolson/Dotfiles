return {
	"Civitasv/cmake-tools.nvim",
	dependencies = { "nvim-lua/plenary.nvim" },
	ft = { "c", "cpp", "objc", "objcpp", "cuda" },
	opts = {
		cmake_command = "cmake",
		cmake_build_directory = "build/${variant:buildType}",
		cmake_generate_options = { "-DCMAKE_EXPORT_COMPILE_COMMANDS=1" },
		cmake_build_options = {},
		cmake_console_size = 10,
		cmake_console_position = "belowright",
		cmake_show_console = "always",
		cmake_dap_configuration = {
			name = "cpp",
			type = "codelldb",
			request = "launch",
			stopOnEntry = false,
			runInTerminal = true,
			console = "integratedTerminal",
		},
		cmake_variants_message = {
			short = { show = true },
			long = { show = true, max_length = 40 },
		},
	},
	config = function(_, opts)
		require("cmake-tools").setup(opts)

		-- Keybindings
		vim.keymap.set("n", "<leader>cg", "<cmd>CMakeGenerate<cr>", { desc = "CMake Generate" })
		vim.keymap.set("n", "<leader>cb", "<cmd>CMakeBuild<cr>", { desc = "CMake Build" })
		vim.keymap.set("n", "<leader>cr", "<cmd>CMakeRun<cr>", { desc = "CMake Run" })
		vim.keymap.set("n", "<leader>cd", "<cmd>CMakeDebug<cr>", { desc = "CMake Debug" })
		vim.keymap.set("n", "<leader>cy", "<cmd>CMakeSelectBuildType<cr>", { desc = "CMake Select Build Type" })
		vim.keymap.set("n", "<leader>ct", "<cmd>CMakeSelectBuildTarget<cr>", { desc = "CMake Select Target" })
		vim.keymap.set("n", "<leader>cl", "<cmd>CMakeSelectLaunchTarget<cr>", { desc = "CMake Select Launch Target" })
		vim.keymap.set("n", "<leader>co", "<cmd>CMakeOpen<cr>", { desc = "CMake Open Console" })
		vim.keymap.set("n", "<leader>cc", "<cmd>CMakeClose<cr>", { desc = "CMake Close Console" })
	end,
}
