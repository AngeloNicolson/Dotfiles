return {
	"olimorris/codecompanion.nvim",
	dependencies = {
		"nvim-lua/plenary.nvim",
		"nvim-treesitter/nvim-treesitter",
		"hrsh7th/nvim-cmp", -- Optional: For using slash commands and variables in the chat buffer
		"nvim-telescope/telescope.nvim", -- Optional: For using slash commands
		{ "stevearc/dressing.nvim", opts = {} }, -- Optional: Improves the default Neovim UI
	},
	config = function()
		require("codecompanion").setup({
			strategies = {
				chat = {
					adapter = "ollama",
				},
				inline = {
					adapter = "ollama",
				},
				agent = {
					adapter = "ollama",
				},
			},
			prompt_library = {
				["Explain"] = {
					strategy = "chat",
					description = "Explain how code works",
					prompts = {
						{
							role = "system",
							content = "You are an expert programmer. Explain the selected code clearly and concisely.",
						},
						{
							role = "user",
							content = function(context)
								return "Explain this code:\n\n```" .. context.filetype .. "\n" .. context.selection .. "\n```"
							end,
						},
					},
				},
				["Refactor"] = {
					strategy = "inline",
					description = "Refactor the code",
					prompts = {
						{
							role = "system",
							content = "You are an expert programmer. Refactor the code to be more efficient and readable.",
						},
						{
							role = "user",
							content = function(context)
								return "Refactor this code:\n\n```" .. context.filetype .. "\n" .. context.selection .. "\n```"
							end,
						},
					},
				},
				["Fix Bugs"] = {
					strategy = "chat",
					description = "Find and fix bugs",
					prompts = {
						{
							role = "system",
							content = "You are an expert debugger. Find and explain bugs in the code.",
						},
						{
							role = "user",
							content = function(context)
								return "Find bugs in this code:\n\n```" .. context.filetype .. "\n" .. context.selection .. "\n```"
							end,
						},
					},
				},
				["Add Comments"] = {
					strategy = "inline",
					description = "Add helpful comments",
					prompts = {
						{
							role = "system",
							content = "You are an expert programmer. Add clear, helpful comments to the code.",
						},
						{
							role = "user",
							content = function(context)
								return "Add comments to this code:\n\n```" .. context.filetype .. "\n" .. context.selection .. "\n```"
							end,
						},
					},
				},
				["Optimize"] = {
					strategy = "chat",
					description = "Optimize code performance",
					prompts = {
						{
							role = "system",
							content = "You are an expert in performance optimization. Suggest optimizations for the code.",
						},
						{
							role = "user",
							content = function(context)
								return "Optimize this code:\n\n```" .. context.filetype .. "\n" .. context.selection .. "\n```"
							end,
						},
					},
				},
			},
			adapters = {
				http = {
					ollama = function()
						return require("codecompanion.adapters").extend("ollama", {
							schema = {
								model = {
									default = "qwen3-coder:30b",
								},
							},
						})
					end,
				},
			},
			display = {
				chat = {
					window = {
						layout = "vertical", -- float|vertical|horizontal|buffer
						border = "rounded",
						height = 0.8,
						width = 0.45,
					},
				},
				inline = {
					-- The inline assistant will show diff changes
					diff = {
						enabled = true,
						close_chat_at = 240, -- Close the chat buffer after 240 seconds
					},
				},
			},
		})
	end,
	keys = {
		{ "<leader>cc", "<cmd>CodeCompanionChat Toggle<cr>", desc = "Toggle CodeCompanion Chat", mode = { "n", "v" } },
		{ "<leader>ca", "<cmd>CodeCompanionActions<cr>", desc = "CodeCompanion Actions", mode = { "n", "v" } },
		{ "<leader>ci", "<cmd>CodeCompanion<cr>", desc = "Inline CodeCompanion", mode = "n" },
		{ "<leader>ci", ":CodeCompanion ", desc = "Inline CodeCompanion", mode = "v" },
		{ "ga", "<cmd>CodeCompanionChat Add<cr>", desc = "Add to CodeCompanion Chat", mode = "v" },
	},
}
