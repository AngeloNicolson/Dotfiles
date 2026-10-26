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
			request_timeout = 10, -- first request after idle cold-loads the model (~3 s)
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
			-- On demand only: nothing appears until <C-]> / <A-]> asks for it.
			-- (`:Minuet virtualtext enable` or <leader>aV turns auto mode on per buffer.)
			virtualtext = {
				auto_trigger_ft = {},
				show_on_completion_menu = true, -- clangd keeps the cmp menu open a lot; still show ghost text
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
		-- Keep the FIM model resident. Ollama unloads after 5 min idle and the
		-- OpenAI-style endpoint ignores keep_alive, so poke the native API (no
		-- prompt = load only) when entering insert mode, at most every 20 min.
		local WARM_FT = { "c", "cpp", "cuda", "glsl", "lua", "python", "clojure" }
		local last_warm = 0
		vim.api.nvim_create_autocmd("InsertEnter", {
			group = vim.api.nvim_create_augroup("minuet-keep-warm", { clear = true }),
			callback = function()
				if not vim.tbl_contains(WARM_FT, vim.bo.filetype) then return end
				local now = os.time()
				if now - last_warm < 1200 then return end
				last_warm = now
				vim.system({ "curl", "-s", "-m", "30", "http://localhost:11434/api/generate",
					"-d", '{"model":"qwen2.5-coder:7b","keep_alive":"1h"}' }, { detach = false })
			end,
		})

		-- Second manual trigger that is a plain control byte, for terminals or
		-- layers where Alt is awkward. Same action as <A-]>.
		vim.keymap.set("i", "<C-]>", function() require("minuet.virtualtext").action.next() end,
			{ desc = "AI ghost text: request / next suggestion" })

		-- Manual cmp trigger for the minuet source (see plugins/autocomplete.lua sources)
		local ok, cmp = pcall(require, "cmp")
		if ok then
			cmp.setup({
				mapping = cmp.mapping.preset.insert({ ["<A-y>"] = require("minuet").make_cmp_map() }),
			})
		end
	end,
}
