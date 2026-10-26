-- Run the launch target under the Khronos validation layer with the settings
-- file in ~/.config/vulkan/kondor-debug/vk_layer_settings.txt (GPU-assisted
-- validation, sync validation, debug printf, best practices).
-- "VUID-..." messages go to the quickfix list.
local target = require("config.target")

local SETTINGS_DIR = vim.fn.expand("~/.config/vulkan/kondor-debug")

local EFM = table.concat({
	[[%EVUID-%m]],
	[[%E%.%#VUID-%m]],
	[[%E%.%#Validation\ Error:\ %m]],
	[[%W%.%#Validation\ Warning:\ %m]],
	[[%W%.%#Validation\ Performance\ Warning:\ %m]],
	[[%-G%.%#]],
}, ",")

---@type overseer.TemplateFileProvider
return {
	cache_key = function(opts)
		return opts.dir
	end,
	generator = function(opts, cb)
		if not target.is_vulkan_project(opts.dir) then
			return "Not a Vulkan project (no shaders / no 'vulkan' in CMakeLists.txt)"
		end
		cb({
			{
				name = "vulkan_validate",
				desc = "Run with VK_LAYER_KHRONOS_validation (gpuav, sync, printf, best practices)",
				tags = { "vulkan", "gpu" },
				params = {
					program = { type = "string", desc = "Executable (blank = cmake launch target / pick)", optional = true },
					args = { type = "list", subtype = { type = "string" }, delimiter = " ", desc = "Program args", optional = true, default = {} },
					settings_dir = { type = "string", desc = "Dir holding vk_layer_settings.txt", default = SETTINGS_DIR },
				},
				builder = function(params)
					local program = (params.program and params.program ~= "") and params.program or target.cmake_launch_target() or target.resolve_sync()
					local cmd = { program }
					vim.list_extend(cmd, params.args or {})
					return {
						cmd = cmd,
						cwd = opts.dir,
						name = "vulkan_validate " .. vim.fn.fnamemodify(program, ":t"),
						env = {
							VK_INSTANCE_LAYERS = "VK_LAYER_KHRONOS_validation",
							VK_LOADER_LAYERS_ENABLE = "*validation",
							VK_LAYER_SETTINGS_PATH = params.settings_dir,
						},
						components = {
							{ "on_output_quickfix", errorformat = EFM, open_on_match = true, items_only = true, tail = true },
							"on_exit_set_status",
							"on_complete_notify",
						},
					}
				end,
			},
		})
	end,
}
