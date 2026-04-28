return {
	"Civitasv/cmake-tools.nvim",
	-- Prefix ownership: <leader>bc (Build -> CMake)
	dependencies = { "nvim-lua/plenary.nvim" },
	ft = { "c", "cpp", "objc", "objcpp", "cuda" },
	opts = {
		cmake_command = "cmake",
		ctest_command = "ctest",
		cmake_use_preset = true,
		cmake_regenerate_on_save = true,
		cmake_build_directory = "build/${variant:buildType}",
		cmake_generate_options = { "-DCMAKE_EXPORT_COMPILE_COMMANDS=1" },
		cmake_compile_commands_options = {
			action = "soft_link",
			target = vim.loop.cwd,
		},
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

		-- Direct build/debug path
		vim.keymap.set("n", "<leader>bb", "<cmd>CMakeBuild<cr>", { desc = "Build CMake build" })
		vim.keymap.set("n", "<leader>br", "<cmd>CMakeRun<cr>", { desc = "Build CMake run" })
		vim.keymap.set("n", "<leader>bd", "<cmd>CMakeDebug<cr>", { desc = "Build CMake debug" })
		vim.keymap.set("n", "<leader>bt", "<cmd>CMakeRunTest<cr>", { desc = "Build CMake test" })

		-- Target and preset selection
		vim.keymap.set("n", "<leader>bcg", "<cmd>CMakeGenerate<cr>", { desc = "CMake generate" })
		vim.keymap.set("n", "<leader>bcb", "<cmd>CMakeBuild<cr>", { desc = "CMake build" })
		vim.keymap.set("n", "<leader>bcr", "<cmd>CMakeRun<cr>", { desc = "CMake run" })
		vim.keymap.set("n", "<leader>bcd", "<cmd>CMakeDebug<cr>", { desc = "CMake debug" })
		vim.keymap.set("n", "<leader>bct", "<cmd>CMakeRunTest<cr>", { desc = "CMake test picker" })
		vim.keymap.set("n", "<leader>bcy", "<cmd>CMakeSelectBuildType<cr>", { desc = "CMake build type" })
		vim.keymap.set("n", "<leader>bcT", "<cmd>CMakeSelectBuildTarget<cr>", { desc = "CMake build target" })
		vim.keymap.set("n", "<leader>bcl", "<cmd>CMakeSelectLaunchTarget<cr>", { desc = "CMake launch target" })
		vim.keymap.set("n", "<leader>bco", "<cmd>CMakeOpen<cr>", { desc = "CMake open console" })
		vim.keymap.set("n", "<leader>bcc", "<cmd>CMakeClose<cr>", { desc = "CMake close console" })
	end,
}
