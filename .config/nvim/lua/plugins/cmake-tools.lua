return {
	"Civitasv/cmake-tools.nvim",
	-- Prefix ownership: <leader>bc (Build -> CMake)
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
		vim.keymap.set("n", "<leader>bcg", "<cmd>CMakeGenerate<cr>", { desc = "CMake generate" })
		vim.keymap.set("n", "<leader>bcb", "<cmd>CMakeBuild<cr>", { desc = "CMake build" })
		vim.keymap.set("n", "<leader>bcr", "<cmd>CMakeRun<cr>", { desc = "CMake run" })
		vim.keymap.set("n", "<leader>bcd", "<cmd>CMakeDebug<cr>", { desc = "CMake debug" })
		vim.keymap.set("n", "<leader>bcy", "<cmd>CMakeSelectBuildType<cr>", { desc = "CMake build type" })
		vim.keymap.set("n", "<leader>bct", "<cmd>CMakeSelectBuildTarget<cr>", { desc = "CMake target" })
		vim.keymap.set("n", "<leader>bcl", "<cmd>CMakeSelectLaunchTarget<cr>", { desc = "CMake launch target" })
		vim.keymap.set("n", "<leader>bco", "<cmd>CMakeOpen<cr>", { desc = "CMake open console" })
		vim.keymap.set("n", "<leader>bcc", "<cmd>CMakeClose<cr>", { desc = "CMake close console" })
	end,
}
