return {
	{
		"Olical/conjure",
		ft = { "clojure", "fennel", "janet", "racket", "scheme" },
		init = function()
			vim.g["conjure#mapping#doc_word"] = "K"
			vim.g["conjure#log#hud#enabled"] = true
			vim.g["conjure#log#hud#width"] = 0.42
			vim.g["conjure#log#hud#height"] = 0.32
			-- Never auto-start a JVM; <leader>cr starts one on purpose via Overseer.
			vim.g["conjure#client#clojure#nrepl#connection#auto_repl#enabled"] = false
			vim.g["conjure#client#clojure#nrepl#connection#auto_repl#cmd"] = ""
			vim.api.nvim_create_autocmd("FileType", {
				pattern = "clojure",
				callback = function()
					vim.b["conjure#client#clojure#nrepl#connection#auto_repl#enabled"] = false
					vim.b["conjure#client#clojure#nrepl#connection#auto_repl#cmd"] = ""
				end,
			})
		end,
	},
	{
		-- Structural editing: >) <) slurp/barf, <localleader>o raise form,
		-- >e/<e drag elements, >f/<f drag forms (default keys).
		"julienvincent/nvim-paredit",
		ft = { "clojure", "fennel", "scheme", "lisp", "janet" },
		opts = { use_default_keys = true },
		config = function(_, opts)
			require("nvim-paredit").setup(opts)
		end,
	},
	{
		-- Clojure/JVM Overseer templates (lua/overseer/template/user/clojure.lua)
		-- get leader keys only in Clojure buffers. <leader>c is otherwise Clipboard.
		"stevearc/overseer.nvim",
		optional = true,
		ft = { "clojure" },
		keys = {
			{ "<leader>cr", "<cmd>OverseerRun clj_nrepl<cr>", ft = "clojure", desc = "Clojure nREPL (clj -M:nrepl)" },
			{ "<leader>cj", "<cmd>OverseerRun jvm_heap<cr>", ft = "clojure", desc = "Clojure JVM heap info (jcmd)" },
			{ "<leader>cf", "<cmd>OverseerRun jvm_jfr<cr>", ft = "clojure", desc = "Clojure JFR 60s recording" },
		},
	},
}
