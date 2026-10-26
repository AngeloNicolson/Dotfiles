-- Inline FIM ghost text from the local Ollama (qwen2.5-coder:7b). Pull the model
-- with `ollama pull qwen2.5-coder:7b`; until it exists minuet just warns.
-- `api_key = "TERM"`: minuet insists on the NAME of a non-empty env var even
-- for keyless local servers, and $TERM is always set in a terminal.
return {
	"milanglacier/minuet-ai.nvim",
	event = "InsertEnter",
	dependencies = { "nvim-lua/plenary.nvim", "hrsh7th/nvim-cmp" },
	keys = {
		{ "<leader>aV", "<cmd>Minuet virtualtext toggle<cr>", desc = "AI ghost text toggle" },
		{ "<leader>aC", "<cmd>Minuet cmp toggle<cr>", desc = "AI cmp source toggle" },
	},
	config = function()
		require("minuet").setup({
			provider = "openai_fim_compatible",
			n_completions = 1, -- local model: one candidate keeps latency sane
			context_window = 4096,
			throttle = 800,
			debounce = 300,
			request_timeout = 4,
			notify = "warn",
			provider_options = {
				openai_fim_compatible = {
					api_key = "TERM",
					name = "Ollama",
					end_point = "http://localhost:11434/v1/completions",
					model = "qwen2.5-coder:7b",
					optional = { max_tokens = 96, top_p = 0.9 },
				},
			},
			-- ghost text on by default for the languages the engine is written in
			virtualtext = {
				auto_trigger_ft = { "c", "cpp", "cuda", "glsl", "lua", "python", "clojure" },
				show_on_completion_menu = false,
				keymap = {
					-- Alt keys: nothing collides with cmp's <Tab>/<CR>/<C-n>/<C-p>
					accept = "<A-a>",
					accept_line = "<A-l>",
					accept_n_lines = "<A-z>",
					prev = "<A-[>",
					next = "<A-]>",
					dismiss = "<A-e>",
				},
			},
			cmp = { enable_auto_complete = false }, -- cmp source is manual: <A-y>
		})
		-- Manual cmp trigger for the minuet source (see plugins/autocomplete.lua sources)
		local ok, cmp = pcall(require, "cmp")
		if ok then
			cmp.setup({
				mapping = cmp.mapping.preset.insert({ ["<A-y>"] = require("minuet").make_cmp_map() }),
			})
		end
	end,
}
