return {
	"olimorris/codecompanion.nvim",
	-- Prefix ownership: <leader>a (AI). The only chat/inline AI stack; Minuet
	-- (plugins/minuet.lua) does FIM ghost text on the same Ollama.
	cmd = { "CodeCompanion", "CodeCompanionChat", "CodeCompanionActions", "CodeCompanionCmd" },
	dependencies = {
		"nvim-lua/plenary.nvim",
		"nvim-treesitter/nvim-treesitter",
		"hrsh7th/nvim-cmp", -- slash commands / variables completion in the chat buffer
		"nvim-telescope/telescope.nvim", -- action palette + pickers
		{
			"MeanderingProgrammer/render-markdown.nvim",
			-- chat buffers only: obsidian.nvim already renders markdown notes
			ft = { "codecompanion" },
			opts = { file_types = { "codecompanion" }, latex = { enabled = false } },
		},
	},
	keys = {
		{ "<leader>ac", "<cmd>CodeCompanionChat Toggle<cr>", desc = "AI chat toggle", mode = { "n", "v" } },
		{ "<leader>ax", "<cmd>CodeCompanionActions<cr>", desc = "AI actions", mode = { "n", "v" } },
		{ "<leader>ai", "<cmd>CodeCompanion<cr>", desc = "AI inline", mode = "n" },
		{ "<leader>ai", ":CodeCompanion ", desc = "AI inline (selection)", mode = "v" },
		{ "<leader>ag", "<cmd>CodeCompanion /gpu<cr>", desc = "AI debug GPU error", mode = { "n", "v" } },
		{ "ga", "<cmd>CodeCompanionChat Add<cr>", desc = "Add selection to AI chat", mode = "v" },
		{ "<leader>ae", function() require("config.ai").explain({ visual = false }) end, desc = "AI explain function under cursor", mode = "n" },
		{ "<leader>ae", function() require("config.ai").explain({ visual = true }) end, desc = "AI explain selection", mode = "v" },
	},
	config = function()
		local function ollama(model_default)
			return require("codecompanion.adapters").extend("ollama", {
				schema = {
					model = { default = model_default },
					-- qwen3 "thinking" doubles latency for code chat; off by default
					think = { default = false },
					num_ctx = { default = 16384 },
				},
			})
		end

		require("codecompanion").setup({
			-- NB: `interactions`, not the pre-v18 `strategies` key.
			interactions = {
				chat = {
					adapter = "ollama",
					opts = { completion_provider = "cmp" },
					slash_commands = {
						-- /expert → "<engine|study|setup|code> question": retrieved chunks from
						-- monolith's indexes become hidden context for the next message.
						["expert"] = {
							description = "Retrieve from a monolith expert (engine/study/setup/code)",
							callback = function(chat)
								require("config.monolith").slash(chat)
							end,
							keymaps = { modes = { n = "ge", i = "<M-e>" } },
							opts = { contains_code = true },
						},
					},
				},
				inline = { adapter = "ollama_fast" },
				cmd = { adapter = "ollama_fast" },
			},
			adapters = {
				http = {
					-- big model for chat; model follows :AIModels (config.ai) via monolith
					ollama = function()
						return ollama(function()
							return require("config.ai").get_current_model()
						end)
					end,
					-- small model for inline edits and :CodeCompanionCmd
					ollama_fast = function()
						return ollama("qwen3:8b")
					end,
				},
			},
			prompt_library = {
				["Debug GPU error"] = {
					interaction = "chat",
					description = "Diagnose a Vulkan/CUDA error with the engine expert",
					opts = { alias = "gpu", auto_submit = false, is_slash_cmd = true },
					prompts = {
						{
							role = "system",
							content = [[You are a graphics/GPU debugging expert (Vulkan, GLFW, ImGui, CUDA, GLSL/SPIR-V).
The user works on Kondor, a C++ Vulkan engine. Reason from the validation-layer /
compute-sanitizer / cuda-gdb output they give you: name the VUID or sanitizer check,
state the exact invariant it guards, point at the call or resource that violated it,
and give the smallest fix. If the output is not enough, say what to run next
(validation layer settings, renderdoc capture, compute-sanitizer tool).
The chat has a `/expert` command: when you need engine-specific context, tell the
user to run `/expert engine <question>` so the retrieved sources appear in the chat.]],
						},
						{
							role = "user",
							content = function(context)
								local parts = {}
								if context.is_visual then
									parts[#parts + 1] = ("Error output / code:\n\n```%s\n%s\n```"):format(
										context.filetype,
										table.concat(context.lines, "\n")
									)
								end
								local diags = vim.diagnostic.get(context.bufnr, { severity = { min = vim.diagnostic.severity.WARN } })
								if #diags > 0 then
									local lines = { "Current diagnostics in " .. vim.fn.fnamemodify(vim.api.nvim_buf_get_name(context.bufnr), ":.") .. ":" }
									for _, d in ipairs(diags) do
										lines[#lines + 1] = ("- L%d: [%s] %s"):format(d.lnum + 1, d.source or "lsp", (d.message:gsub("\n", " ")))
									end
									parts[#parts + 1] = table.concat(lines, "\n")
								end
								if #parts == 0 then
									parts[1] = "Paste the validation-layer / compute-sanitizer / cuda-gdb output here."
								end
								parts[#parts + 1] = "First run `/expert engine <what this error is about>` to pull the engine docs, then explain the error and the fix."
								return table.concat(parts, "\n\n")
							end,
						},
					},
				},
				["Explain"] = {
					interaction = "chat",
					description = "Explain how code works (<leader>ae: selection, or the function under the cursor)",
					opts = { modes = { "v" }, auto_submit = true, short_name = "explain", is_slash_cmd = true },
					prompts = {
						{ role = "system", content = "You are an expert programmer. Explain the selected code clearly and concisely." },
						{
							role = "user",
							content = function(context)
								return "Explain this code:\n\n```" .. context.filetype .. "\n" .. table.concat(context.lines, "\n") .. "\n```"
							end,
						},
					},
				},
				["Refactor"] = {
					interaction = "inline",
					description = "Refactor the code",
					opts = { modes = { "v" }, placement = "replace" },
					prompts = {
						{ role = "system", content = "You are an expert programmer. Refactor the code to be more efficient and readable. Return only code." },
						{
							role = "user",
							content = function(context)
								return "Refactor this code:\n\n```" .. context.filetype .. "\n" .. table.concat(context.lines, "\n") .. "\n```"
							end,
						},
					},
				},
				["Fix Bugs"] = {
					interaction = "chat",
					description = "Find and fix bugs",
					opts = { modes = { "v" }, auto_submit = true },
					prompts = {
						{ role = "system", content = "You are an expert debugger. Find and explain bugs in the code." },
						{
							role = "user",
							content = function(context)
								return "Find bugs in this code:\n\n```" .. context.filetype .. "\n" .. table.concat(context.lines, "\n") .. "\n```"
							end,
						},
					},
				},
				["Add Comments"] = {
					interaction = "inline",
					description = "Add helpful comments",
					opts = { modes = { "v" }, placement = "replace" },
					prompts = {
						{ role = "system", content = "You are an expert programmer. Add clear, helpful comments to the code. Return only code." },
						{
							role = "user",
							content = function(context)
								return "Add comments to this code:\n\n```" .. context.filetype .. "\n" .. table.concat(context.lines, "\n") .. "\n```"
							end,
						},
					},
				},
				["Optimize"] = {
					interaction = "chat",
					description = "Optimize code performance",
					opts = { modes = { "v" }, auto_submit = true },
					prompts = {
						{ role = "system", content = "You are an expert in performance optimization. Suggest optimizations for the code." },
						{
							role = "user",
							content = function(context)
								return "Optimize this code:\n\n```" .. context.filetype .. "\n" .. table.concat(context.lines, "\n") .. "\n```"
							end,
						},
					},
				},
			},
			display = {
				action_palette = {
					provider = "telescope",
					opts = { show_preset_prompts = false },
				},
				chat = {
					window = { layout = "vertical", border = "rounded", height = 0.8, width = 0.45 },
				},
				inline = {
					diff = { enabled = true, close_chat_at = 240 },
				},
			},
		})
	end,
}
