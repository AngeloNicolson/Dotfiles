return {
	"olimorris/codecompanion.nvim",
	-- Prefix ownership: <leader>a (AI)
	dependencies = {
		"nvim-lua/plenary.nvim",
		"nvim-treesitter/nvim-treesitter",
		"hrsh7th/nvim-cmp", -- Optional: For using slash commands and variables in the chat buffer
		"nvim-telescope/telescope.nvim", -- Optional: For using slash commands
		{ "stevearc/dressing.nvim", opts = {} }, -- Optional: Improves the default Neovim UI
	},
	config = function()
		require("codecompanion").setup({
			interactions = {
				chat = {
					opts = {
						completion_provider = "cmp",
					},
				},
			},
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
									default = function()
										return require("config.ai").get_current_model()
									end,
								},
							},
						})
					end,
				},
			},
			display = {
				action_palette = {
					opts = {
						-- Upstream built-in markdown prompts are currently noisy in this install.
						show_preset_prompts = false,
					},
				},
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

		local ok, parser = pcall(require, "codecompanion.interactions.chat.parser")
		if ok and not parser._safe_messages_patch then
			local helpers = require("codecompanion.interactions.chat.helpers")
			local original_messages = parser.messages

			parser.messages = function(chat, start_range)
				local ok_parse, result = pcall(original_messages, chat, start_range)
				if ok_parse then
					return result
				end

				vim.schedule(function()
					vim.notify("CodeCompanion chat parser fell back to plain text parsing", vim.log.levels.WARN, {
						title = "CodeCompanion",
					})
				end)

				local lines = vim.api.nvim_buf_get_lines(chat.bufnr, start_range - 1, -1, false)
				if not lines or vim.tbl_isempty(lines) then
					return nil
				end

				if lines[1] and lines[1]:match("^##%s+") then
					table.remove(lines, 1)
				end

				while lines[1] and vim.trim(lines[1]) == "" do
					table.remove(lines, 1)
				end

				lines = helpers.strip_context(lines)
				local content = vim.trim(table.concat(lines, "\n"))
				if content == "" then
					return nil
				end

				return { content = content }
			end

			parser._safe_messages_patch = true
		end

		local ok_ui, UI = pcall(require, "codecompanion.interactions.chat.ui")
		if ok_ui and not UI._safe_display_tokens_patch then
			local original_display_tokens = UI.display_tokens

			UI.display_tokens = function(self, parser, start_row)
				local ok_tokens, err = pcall(original_display_tokens, self, parser, start_row)
				if ok_tokens then
					return
				end

				if not self._safe_display_tokens_warning_shown then
					self._safe_display_tokens_warning_shown = true
					vim.schedule(function()
						vim.notify(
							"CodeCompanion token count display was skipped: " .. tostring(err),
							vim.log.levels.WARN,
							{ title = "CodeCompanion" }
						)
					end)
				end
			end

			UI._safe_display_tokens_patch = true
		end
	end,
	keys = {
		{ "<leader>ac", "<cmd>CodeCompanionChat Toggle<cr>", desc = "AI chat", mode = { "n", "v" } },
		{ "<leader>ax", "<cmd>CodeCompanionActions<cr>", desc = "AI actions", mode = { "n", "v" } },
		{ "<leader>ai", "<cmd>CodeCompanion<cr>", desc = "AI inline", mode = "n" },
		{ "<leader>ai", ":CodeCompanion ", desc = "AI inline", mode = "v" },
		{ "ga", "<cmd>CodeCompanionChat Add<cr>", desc = "Add to CodeCompanion Chat", mode = "v" },
	},
}
