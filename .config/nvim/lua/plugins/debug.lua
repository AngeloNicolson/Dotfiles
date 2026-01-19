return {
	-- nvim-dap: Debug Adapter Protocol client
	{
		"mfussenegger/nvim-dap",
		dependencies = {
			-- UI for nvim-dap
			{
				"rcarriga/nvim-dap-ui",
				dependencies = { "nvim-neotest/nvim-nio" },
			},

			-- Mason integration for DAP
			"jay-babu/mason-nvim-dap.nvim",

			-- Virtual text for debugging
			"theHamsta/nvim-dap-virtual-text",
		},
		config = function()
			local dap = require("dap")
			local dapui = require("dapui")

			-- Setup mason-nvim-dap
			require("mason-nvim-dap").setup({
				automatic_installation = false,
				ensure_installed = {
					"codelldb", -- C/C++/Rust debugger
				},
				handlers = {},
			})

			-- =============================================
			-- C++ / CODELLDB ADAPTER CONFIG
			-- =============================================
			dap.adapters.codelldb = {
				type = "server",
				port = "${port}",
				executable = {
					command = vim.fn.stdpath("data") .. "/mason/bin/codelldb",
					args = { "--port", "${port}" },
				},
			}

			-- C++ launch configurations
			dap.configurations.cpp = {
				{
					name = "WildCore Engine",
					type = "codelldb",
					request = "launch",
					program = function()
						-- Check common build directories
						local build_dirs = {
							"build/WildCore",
							"build/debug/WildCore",
							"build/Debug/WildCore",
							"cmake-build-debug/WildCore",
						}
						for _, path in ipairs(build_dirs) do
							local full_path = vim.fn.getcwd() .. "/" .. path
							if vim.fn.filereadable(full_path) == 1 then
								return full_path
							end
						end
						-- Fallback to manual input
						return vim.fn.input("Executable: ", vim.fn.getcwd() .. "/build/WildCore", "file")
					end,
					cwd = "${workspaceFolder}",
					stopOnEntry = false,
					args = {},
					-- Game dev: run from project root for asset paths
					runInTerminal = false,
					-- Source map for better debugging
					sourceMap = {
						["${workspaceFolder}"] = "${workspaceFolder}",
					},
				},
				{
					name = "Launch with args",
					type = "codelldb",
					request = "launch",
					program = function()
						return vim.fn.input("Executable: ", vim.fn.getcwd() .. "/build/WildCore", "file")
					end,
					cwd = "${workspaceFolder}",
					stopOnEntry = false,
					args = function()
						local args_string = vim.fn.input("Arguments: ")
						return vim.split(args_string, " ")
					end,
				},
				{
					name = "Attach to process",
					type = "codelldb",
					request = "attach",
					pid = require("dap.utils").pick_process,
					cwd = "${workspaceFolder}",
				},
			}
			-- Use same config for C
			dap.configurations.c = dap.configurations.cpp

			-- =============================================
			-- GAME DEV OPTIMIZED UI LAYOUT
			-- =============================================
			dapui.setup({
				icons = { expanded = "▾", collapsed = "▸", current_frame = "→" },
				mappings = {
					expand = { "<CR>", "<2-LeftMouse>" },
					open = "o",
					remove = "d",
					edit = "e",
					repl = "r",
					toggle = "t",
				},
				layouts = {
					{
						-- Left side: variables and watches (important for game dev)
						elements = {
							{ id = "scopes", size = 0.4 }, -- Local vars, great for vectors/matrices
							{ id = "watches", size = 0.3 }, -- Custom expressions
							{ id = "breakpoints", size = 0.15 },
							{ id = "stacks", size = 0.15 },
						},
						size = 50, -- Wider for long variable names
						position = "left",
					},
					{
						-- Bottom: console and repl
						elements = {
							{ id = "repl", size = 0.5 },
							{ id = "console", size = 0.5 },
						},
						size = 12,
						position = "bottom",
					},
				},
				controls = {
					enabled = true,
					element = "repl",
					icons = {
						pause = "⏸",
						play = "▶",
						step_into = "↓",
						step_over = "→",
						step_out = "↑",
						step_back = "←",
						run_last = "⟳",
						terminate = "■",
						disconnect = "⏏",
					},
				},
				floating = {
					max_height = 0.6,
					max_width = 0.6,
					border = "rounded",
					mappings = {
						close = { "q", "<Esc>" },
					},
				},
				render = {
					indent = 2,
					-- Show types - helpful for game dev (vec3, mat4, etc)
					max_type_length = 30,
				},
			})

			-- Setup virtual text (shows values inline)
			require("nvim-dap-virtual-text").setup({
				enabled = true,
				enabled_commands = true,
				highlight_changed_variables = true,
				highlight_new_as_changed = true,
				show_stop_reason = true,
				commented = false,
				only_first_definition = true,
				all_references = false,
				display_callback = function(variable, _buf, _stackframe, _node)
					-- Truncate long values (common with game vectors)
					local value = variable.value
					if #value > 50 then
						value = value:sub(1, 47) .. "..."
					end
					return " = " .. value
				end,
			})

			-- Auto-open/close dap-ui
			dap.listeners.after.event_initialized["dapui_config"] = function()
				dapui.open()
			end
			dap.listeners.before.event_terminated["dapui_config"] = function()
				dapui.close()
			end
			dap.listeners.before.event_exited["dapui_config"] = function()
				dapui.close()
			end

			-- =============================================
			-- GAME DEV KEYBINDS (all under <leader>d)
			-- =============================================

			-- Core debugging (always use cpp config, even from neo-tree etc)
			vim.keymap.set("n", "<F5>", function()
				if dap.session() then
					dap.continue()
				else
					dap.run(dap.configurations.cpp[1])
				end
			end, { desc = "Debug: Start/Continue" })
			vim.keymap.set("n", "<F17>", dap.terminate, { desc = "Debug: Stop (Shift+F5)" }) -- Shift+F5
			vim.keymap.set("n", "<F29>", dap.restart, { desc = "Debug: Restart (Ctrl+F5)" }) -- Ctrl+F5

			-- Stepping
			vim.keymap.set("n", "<F10>", dap.step_over, { desc = "Debug: Step Over" })
			vim.keymap.set("n", "<F11>", dap.step_into, { desc = "Debug: Step Into" })
			vim.keymap.set("n", "<F23>", dap.step_out, { desc = "Debug: Step Out (Shift+F11)" }) -- Shift+F11

			-- Leader-based keybinds (more discoverable)
			vim.keymap.set("n", "<leader>dc", dap.continue, { desc = "Debug: Continue" })
			vim.keymap.set("n", "<leader>ds", dap.step_over, { desc = "Debug: Step Over" })
			vim.keymap.set("n", "<leader>di", dap.step_into, { desc = "Debug: Step Into" })
			vim.keymap.set("n", "<leader>do", dap.step_out, { desc = "Debug: Step Out" })
			vim.keymap.set("n", "<leader>dq", dap.terminate, { desc = "Debug: Quit/Stop" })
			vim.keymap.set("n", "<leader>dr", dap.restart, { desc = "Debug: Restart" })

			-- Breakpoints
			vim.keymap.set("n", "<leader>db", dap.toggle_breakpoint, { desc = "Debug: Toggle Breakpoint" })
			vim.keymap.set("n", "<leader>dB", function()
				dap.set_breakpoint(vim.fn.input("Condition: "))
			end, { desc = "Debug: Conditional Breakpoint" })
			vim.keymap.set("n", "<leader>dl", function()
				dap.set_breakpoint(nil, nil, vim.fn.input("Log message: "))
			end, { desc = "Debug: Logpoint" })
			vim.keymap.set("n", "<leader>dx", dap.clear_breakpoints, { desc = "Debug: Clear All Breakpoints" })

			-- UI controls
			vim.keymap.set("n", "<leader>du", dapui.toggle, { desc = "Debug: Toggle UI" })
			vim.keymap.set("n", "<leader>de", dapui.eval, { desc = "Debug: Evaluate Expression" })
			vim.keymap.set("v", "<leader>de", dapui.eval, { desc = "Debug: Evaluate Selection" })
			vim.keymap.set("n", "<leader>df", function()
				dapui.float_element("scopes", { enter = true })
			end, { desc = "Debug: Float Variables" })
			vim.keymap.set("n", "<leader>dw", function()
				dapui.float_element("watches", { enter = true })
			end, { desc = "Debug: Float Watches" })

			-- Run to cursor (super useful for game loops)
			vim.keymap.set("n", "<leader>dC", dap.run_to_cursor, { desc = "Debug: Run to Cursor" })

			-- REPL
			vim.keymap.set("n", "<leader>dR", dap.repl.toggle, { desc = "Debug: Toggle REPL" })

			-- Quick add watch (useful for tracking game state)
			vim.keymap.set("n", "<leader>da", function()
				local word = vim.fn.expand("<cword>")
				require("dapui").elements.watches.add(word)
				print("Added watch: " .. word)
			end, { desc = "Debug: Add Watch (word under cursor)" })

			-- Frame navigation
			vim.keymap.set("n", "<leader>dk", dap.up, { desc = "Debug: Go Up Stack Frame" })
			vim.keymap.set("n", "<leader>dj", dap.down, { desc = "Debug: Go Down Stack Frame" })

			-- =============================================
			-- BREAKPOINT SIGNS (make them visible)
			-- =============================================
			vim.fn.sign_define("DapBreakpoint", { text = "●", texthl = "DapBreakpoint", linehl = "", numhl = "" })
			vim.fn.sign_define(
				"DapBreakpointCondition",
				{ text = "◆", texthl = "DapBreakpointCondition", linehl = "", numhl = "" }
			)
			vim.fn.sign_define("DapLogPoint", { text = "◇", texthl = "DapLogPoint", linehl = "", numhl = "" })
			vim.fn.sign_define("DapStopped", { text = "→", texthl = "DapStopped", linehl = "DapStoppedLine", numhl = "" })
			vim.fn.sign_define(
				"DapBreakpointRejected",
				{ text = "○", texthl = "DapBreakpointRejected", linehl = "", numhl = "" }
			)

			-- Highlight for current line when stopped
			vim.api.nvim_set_hl(0, "DapBreakpoint", { fg = "#e06c75" }) -- Red
			vim.api.nvim_set_hl(0, "DapBreakpointCondition", { fg = "#e5c07b" }) -- Yellow
			vim.api.nvim_set_hl(0, "DapLogPoint", { fg = "#61afef" }) -- Blue
			vim.api.nvim_set_hl(0, "DapStopped", { fg = "#98c379" }) -- Green
			vim.api.nvim_set_hl(0, "DapStoppedLine", { bg = "#2e4d3d" }) -- Subtle green background
		end,
	},
}
