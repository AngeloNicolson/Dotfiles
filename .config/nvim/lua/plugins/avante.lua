return {
	"yetone/avante.nvim",
	event = "VeryLazy",
	lazy = false,
	version = false,
	opts = {
		provider = "ollama",
		system_prompt = [[You are an expert coding assistant. Respond directly with code and explanations.
IMPORTANT: Do not output your thinking process, reasoning, or internal thoughts.
Do not use phrases like "🤔 Thoughts" or show your reasoning steps.
Respond directly and concisely with the answer, code, or explanation requested.]],
		behaviour = {
			auto_suggestions = false,
			auto_set_highlight_group = true,
			auto_set_keymaps = true,
			support_paste_from_clipboard = true,
		},
		providers = {
			ollama = {
				endpoint = "http://127.0.0.1:11434",
				model = "qwen3-coder:30b",
				timeout = 30000,
				extra_request_body = {
					options = {
						temperature = 0.7,
						num_ctx = 8192,
						keep_alive = "5m",
					},
				},
			},
		},
		hints = { enabled = false },
	},
	build = "make",
	keys = {
		{ "<leader>aa", mode = { "n", "v" }, desc = "Avante: Show sidebar" },
		{ "<leader>at", mode = { "n", "v" }, desc = "Avante: Toggle sidebar" },
		{ "<leader>ae", "<cmd>AvanteEdit<cr>", mode = "v", desc = "Avante: Edit selection" },
		{ "<leader>ar", "<cmd>AvanteRefresh<cr>", mode = "n", desc = "Avante: Refresh" },
		{ "<leader>af", "<cmd>AvanteFocus<cr>", mode = "n", desc = "Avante: Focus sidebar" },
	},
	dependencies = {
		"nvim-treesitter/nvim-treesitter",
		"stevearc/dressing.nvim",
		"nvim-lua/plenary.nvim",
		"MunifTanjim/nui.nvim",
		"nvim-tree/nvim-web-devicons",
		{
			"HakonHarnes/img-clip.nvim",
			event = "VeryLazy",
			opts = {
				default = {
					embed_image_as_base64 = false,
					prompt_for_file_name = false,
					drag_and_drop = {
						insert_mode = true,
					},
				},
			},
		},
		{
			"MeanderingProgrammer/render-markdown.nvim",
			opts = {
				file_types = { "markdown", "Avante" },
			},
			ft = { "markdown", "Avante" },
		},
	},
}
