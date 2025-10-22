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
			adapters = {
				ollama = function()
					return require("codecompanion.adapters").extend("ollama", {
						schema = {
							model = {
								default = "qwen2.5-coder:7b-instruct-q6_K",
							},
						},
					})
				end,
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
