return {
	"stevearc/overseer.nvim",
	-- Prefix ownership: <leader>bo (Build -> Overseer); also the executor/runner
	-- behind cmake-tools and the host of lua/overseer/template/user/*.lua
	-- (cuda_*check, vulkan_validate, renderdoc_capture, glsl_debug_build,
	-- clang_tidy, clj_nrepl, jvm_heap, jvm_jfr).
	cmd = {
		"OverseerToggle", "OverseerOpen", "OverseerClose", "OverseerRun", "OverseerRunCmd",
		"OverseerBuild", "OverseerQuickAction", "OverseerTaskAction", "OverseerInfo",
		"OverseerLoadBundle", "OverseerSaveBundle", "OverseerClearCache",
	},
	keys = {
		{ "<leader>boo", "<cmd>OverseerToggle<cr>", desc = "Overseer toggle" },
		{ "<leader>bor", "<cmd>OverseerRun<cr>", desc = "Overseer run task" },
		{ "<leader>bob", "<cmd>OverseerBuild<cr>", desc = "Overseer build task" },
		{ "<leader>boq", "<cmd>OverseerQuickAction<cr>", desc = "Overseer quick action" },
		{ "<leader>boa", "<cmd>OverseerTaskAction<cr>", desc = "Overseer task action" },
		-- GPU debugging workflows (templates in lua/overseer/template/user/)
		{ "<leader>bgm", "<cmd>OverseerRun cuda_memcheck<cr>", desc = "GPU compute-sanitizer memcheck" },
		{ "<leader>bgr", "<cmd>OverseerRun cuda_racecheck<cr>", desc = "GPU compute-sanitizer racecheck" },
		{ "<leader>bgi", "<cmd>OverseerRun cuda_initcheck<cr>", desc = "GPU compute-sanitizer initcheck" },
		{ "<leader>bgs", "<cmd>OverseerRun cuda_synccheck<cr>", desc = "GPU compute-sanitizer synccheck" },
		{ "<leader>bgv", "<cmd>OverseerRun vulkan_validate<cr>", desc = "GPU run with Vulkan validation" },
		{ "<leader>bgc", "<cmd>OverseerRun renderdoc_capture<cr>", desc = "GPU RenderDoc capture" },
		{ "<leader>bgo", "<cmd>OverseerRun renderdoc_open<cr>", desc = "GPU open newest .rdc" },
		{ "<leader>bgg", "<cmd>OverseerRun glsl_debug_build<cr>", desc = "GPU glslc -O0 -g shaders" },
		{ "<leader>bgt", "<cmd>OverseerRun clang_tidy<cr>", desc = "GPU clang-tidy current file" },
	},
	opts = {
		-- the "jobstart" strategy is the default; this is its terminal switch
		output = { use_terminal = true, preserve_output = false },
		task_list = {
			direction = "bottom",
			min_height = 12,
			max_height = 25,
			keymaps = {
				["?"] = "keymap.show_help",
				["<CR>"] = "keymap.run_action",
				["<C-e>"] = { "keymap.run_action", opts = { action = "edit" }, desc = "Edit task" },
				["o"] = "keymap.open",
				["<C-v>"] = { "keymap.open", opts = { dir = "vsplit" }, desc = "Open output in vsplit" },
				["<C-s>"] = { "keymap.open", opts = { dir = "split" }, desc = "Open output in split" },
				["<C-f>"] = { "keymap.open", opts = { dir = "float" }, desc = "Open output in float" },
				["<C-q>"] = { "keymap.run_action", opts = { action = "open output in quickfix" }, desc = "Output to quickfix" },
				["p"] = "keymap.toggle_preview",
				["{"] = "keymap.prev_task",
				["}"] = "keymap.next_task",
				["<C-k>"] = "keymap.scroll_output_up",
				["<C-j>"] = "keymap.scroll_output_down",
				["q"] = { "<CMD>close<CR>", desc = "Close task list" },
			},
		},
		form = { border = "rounded", win_opts = { winblend = 0 } },
		task_win = { border = "rounded", win_opts = { winblend = 0 } },
	},
}
