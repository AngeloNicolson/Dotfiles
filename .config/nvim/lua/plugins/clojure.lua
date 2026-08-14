return {
	{
		"Olical/conjure",
		ft = { "clojure", "fennel", "janet", "racket", "scheme" },
		init = function()
			vim.g["conjure#mapping#doc_word"] = "K"
			vim.g["conjure#log#hud#enabled"] = true
			vim.g["conjure#log#hud#width"] = 0.42
			vim.g["conjure#log#hud#height"] = 0.32
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
}
