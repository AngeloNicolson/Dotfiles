return {
	-- nvim-dap: Debug Adapter Protocol client. codelldb for C/C++ (Mason),
	-- cuda-gdb (DAP mode) for CUDA kernels. Loaded on first debug key/command.
	{
		"mfussenegger/nvim-dap",
		-- Prefix ownership: <leader>d (Debug)
		cmd = { "DapContinue", "DapToggleBreakpoint", "DapNew", "DapTerminate", "DapShowLog" },
		keys = {
			{ "<F5>", function()
				local dap = require("dap")
				if dap.session() then
					dap.continue()
				else
					dap.run(dap.configurations[vim.bo.filetype == "cuda" and "cuda" or "cpp"][1])
				end
			end, desc = "Debug: Start/Continue" },
			{ "<F17>", function() require("dap").terminate() end, desc = "Debug: Stop (Shift+F5)" },
			{ "<F29>", function() require("dap").restart() end, desc = "Debug: Restart (Ctrl+F5)" },
			{ "<F10>", function() require("dap").step_over() end, desc = "Debug: Step Over" },
			{ "<F11>", function() require("dap").step_into() end, desc = "Debug: Step Into" },
			{ "<F23>", function() require("dap").step_out() end, desc = "Debug: Step Out (Shift+F11)" },
			{ "<leader>dc", function() require("dap").continue() end, desc = "Debug: Continue / pick config" },
			{ "<leader>dg", function()
				local dap = require("dap")
				for _, c in ipairs(dap.configurations.cpp) do
					if c.type == "cuda_gdb" then
						return dap.run(c)
					end
				end
			end, desc = "Debug: Launch under cuda-gdb" },
			{ "<leader>dn", function() require("dap").step_over() end, desc = "Debug: Step Over" },
			{ "<leader>di", function() require("dap").step_into() end, desc = "Debug: Step Into" },
			{ "<leader>do", function() require("dap").step_out() end, desc = "Debug: Step Out" },
			{ "<leader>dq", function() require("dap").terminate() end, desc = "Debug: Quit/Stop" },
			{ "<leader>dr", function() require("dap").restart() end, desc = "Debug: Restart" },
			{ "<leader>db", function() require("dap").toggle_breakpoint() end, desc = "Debug: Toggle Breakpoint" },
			{ "<leader>dB", function() require("dap").set_breakpoint(vim.fn.input("Condition: ")) end, desc = "Debug: Conditional Breakpoint" },
			{ "<leader>dl", function() require("dap").set_breakpoint(nil, nil, vim.fn.input("Log message: ")) end, desc = "Debug: Logpoint" },
			{ "<leader>dx", function() require("dap").clear_breakpoints() end, desc = "Debug: Clear All Breakpoints" },
			{ "<leader>dC", function() require("dap").run_to_cursor() end, desc = "Debug: Run to Cursor" },
			{ "<leader>dR", function() require("dap").repl.toggle() end, desc = "Debug: Toggle REPL" },
			{ "<leader>dk", function() require("dap").up() end, desc = "Debug: Go Up Stack Frame" },
			{ "<leader>dj", function() require("dap").down() end, desc = "Debug: Go Down Stack Frame" },
			{ "<leader>du", function() require("dapui").toggle() end, desc = "Debug: Toggle UI" },
			{ "<leader>de", function() require("dapui").eval() end, desc = "Debug: Evaluate", mode = { "n", "v" } },
			{ "<leader>df", function() require("dapui").float_element("scopes", { enter = true }) end, desc = "Debug: Float Variables" },
			{ "<leader>dw", function() require("dapui").float_element("watches", { enter = true }) end, desc = "Debug: Float Watches" },
			{ "<leader>da", function()
				local word = vim.fn.expand("<cword>")
				require("dapui").elements.watches.add(word)
				vim.notify("Added watch: " .. word)
			end, desc = "Debug: Add Watch (word under cursor)" },
		},
		dependencies = {
			{ "rcarriga/nvim-dap-ui", dependencies = { "nvim-neotest/nvim-nio" } },
			"jay-babu/mason-nvim-dap.nvim",
			"theHamsta/nvim-dap-virtual-text",
		},
		init = function()
			vim.filetype.add({ extension = { cu = "cuda", cuh = "cuda" } })
		end,
		config = function()
			local dap = require("dap")
			local dapui = require("dapui")
			local target = require("config.target")

			-- install only; no `handlers` so mason-nvim-dap does not auto-define
			-- adapters for every Mason debugger (debugpy would get an empty command)
			require("mason-nvim-dap").setup({
				automatic_installation = false,
				ensure_installed = { "codelldb" },
			})

			-- Adapters ---------------------------------------------------------------
			dap.adapters.codelldb = {
				type = "server",
				port = "${port}",
				executable = {
					command = vim.fn.stdpath("data") .. "/mason/bin/codelldb",
					args = { "--port", "${port}" },
				},
			}
			-- cuda-gdb speaks DAP natively (`cuda-gdb -i dap`), verified on this box.
			dap.adapters.cuda_gdb = {
				type = "executable",
				command = "/opt/cuda/bin/cuda-gdb",
				args = { "-i", "dap" },
			}

			-- Configurations ----------------------------------------------------------
			local cuda_launch = {
				name = "CUDA (cuda-gdb)",
				type = "cuda_gdb",
				request = "launch",
				program = target.resolve_sync,
				cwd = "${workspaceFolder}",
				stopAtBeginningOfMainSubprogram = false,
				args = {},
			}
			dap.configurations.cpp = {
				{
					name = "Launch (cmake target / build/Debug)",
					type = "codelldb",
					request = "launch",
					program = target.resolve_sync,
					cwd = "${workspaceFolder}",
					stopOnEntry = false,
					args = {},
					runInTerminal = false, -- run from project root for asset paths
					sourceMap = { ["${workspaceFolder}"] = "${workspaceFolder}" },
				},
				{
					name = "Launch with args",
					type = "codelldb",
					request = "launch",
					program = target.resolve_sync,
					cwd = "${workspaceFolder}",
					stopOnEntry = false,
					args = function()
						return vim.split(vim.fn.input("Arguments: "), " ", { trimempty = true })
					end,
				},
				{
					name = "Attach to process",
					type = "codelldb",
					request = "attach",
					pid = require("dap.utils").pick_process,
					cwd = "${workspaceFolder}",
				},
				cuda_launch,
			}
			dap.configurations.c = dap.configurations.cpp
			dap.configurations.cuda = {
				cuda_launch,
				{
					name = "CUDA attach (cuda-gdb)",
					type = "cuda_gdb",
					request = "attach",
					pid = require("dap.utils").pick_process,
					cwd = "${workspaceFolder}",
				},
			}

			-- UI ------------------------------------------------------------------
			dapui.setup({
				icons = { expanded = "▾", collapsed = "▸", current_frame = "→" },
				mappings = { expand = { "<CR>", "<2-LeftMouse>" }, open = "o", remove = "d", edit = "e", repl = "r", toggle = "t" },
				layouts = {
					{
						elements = { { id = "scopes", size = 0.45 }, { id = "watches", size = 0.35 }, { id = "breakpoints", size = 0.20 } },
						size = 50,
						position = "left",
					},
					{ elements = { { id = "stacks", size = 1.0 } }, size = 45, position = "right" },
					{ elements = { { id = "repl", size = 0.5 }, { id = "console", size = 0.5 } }, size = 12, position = "bottom" },
				},
				controls = {
					enabled = true,
					element = "repl",
					icons = { pause = "⏸", play = "▶", step_into = "↓", step_over = "→", step_out = "↑", step_back = "←", run_last = "⟳", terminate = "■", disconnect = "⏏" },
				},
				floating = { max_height = 0.6, max_width = 0.6, border = "rounded", mappings = { close = { "q", "<Esc>" } } },
				render = { indent = 2, max_type_length = 30 }, -- show types (vec3, mat4, ...)
			})

			require("nvim-dap-virtual-text").setup({
				enabled = true,
				enabled_commands = true,
				highlight_changed_variables = true,
				highlight_new_as_changed = true,
				show_stop_reason = true,
				commented = false,
				only_first_definition = true,
				all_references = false,
				display_callback = function(variable)
					local value = variable.value
					if #value > 50 then
						value = value:sub(1, 47) .. "..."
					end
					return " = " .. value
				end,
			})

			dap.listeners.after.event_initialized["dapui_config"] = function() dapui.open() end
			dap.listeners.before.event_terminated["dapui_config"] = function() dapui.close() end
			dap.listeners.before.event_exited["dapui_config"] = function() dapui.close() end

			-- Signs ----------------------------------------------------------------
			vim.fn.sign_define("DapBreakpoint", { text = "●", texthl = "DapBreakpoint" })
			vim.fn.sign_define("DapBreakpointCondition", { text = "◆", texthl = "DapBreakpointCondition" })
			vim.fn.sign_define("DapLogPoint", { text = "◇", texthl = "DapLogPoint" })
			vim.fn.sign_define("DapStopped", { text = "→", texthl = "DapStopped", linehl = "DapStoppedLine" })
			vim.fn.sign_define("DapBreakpointRejected", { text = "○", texthl = "DapBreakpointRejected" })
			vim.api.nvim_set_hl(0, "DapBreakpoint", { fg = "#e06c75" })
			vim.api.nvim_set_hl(0, "DapBreakpointCondition", { fg = "#e5c07b" })
			vim.api.nvim_set_hl(0, "DapLogPoint", { fg = "#61afef" })
			vim.api.nvim_set_hl(0, "DapStopped", { fg = "#98c379" })
			vim.api.nvim_set_hl(0, "DapStoppedLine", { bg = "#2e4d3d" })
		end,
	},
}
