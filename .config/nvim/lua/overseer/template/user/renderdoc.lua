-- RenderDoc:
--   renderdoc_capture : run the launch target under renderdoccmd (captures to
--                       captures/<name>_frame*.rdc, F12 in-app to capture) and,
--                       when the program exits, open the newest .rdc in qrenderdoc.
--   renderdoc_open    : only the second step (newest captures/*.rdc).
local target = require("config.target")

local OPEN_NEWEST = [[f=$(ls -t captures/*.rdc 2>/dev/null | head -n1); if [ -n "$f" ]; then echo "opening $f"; setsid -f qrenderdoc "$f" >/dev/null 2>&1; else echo "no .rdc under captures/"; exit 1; fi]]

---@type overseer.TemplateFileProvider
return {
	cache_key = function(opts)
		return opts.dir
	end,
	generator = function(opts, cb)
		if vim.fn.executable("renderdoccmd") == 0 then
			return "renderdoccmd not found"
		end
		if not target.is_vulkan_project(opts.dir) then
			return "Not a Vulkan project"
		end
		cb({
			{
				name = "renderdoc_capture",
				desc = "renderdoccmd capture -c captures/<name> <target>, then qrenderdoc on the newest .rdc",
				tags = { "vulkan", "gpu" },
				params = {
					program = { type = "string", desc = "Executable (blank = cmake launch target / pick)", optional = true },
					args = { type = "list", subtype = { type = "string" }, delimiter = " ", desc = "Program args", optional = true, default = {} },
					name = { type = "string", desc = "Capture name (blank = <exe>_<timestamp>)", optional = true, default = "" },
					open = { type = "boolean", desc = "Open newest .rdc in qrenderdoc when the program exits", default = true },
				},
				builder = function(params)
					local program = (params.program and params.program ~= "") and params.program or target.cmake_launch_target() or target.resolve_sync()
					local name = (params.name and params.name ~= "") and params.name or vim.fn.fnamemodify(program, ":t") .. "_" .. os.date("%Y%m%d-%H%M%S")
					vim.fn.mkdir(opts.dir .. "/captures", "p")
					local parts = { "renderdoccmd", "capture", "--wait-for-exit", "--capture-file", vim.fn.shellescape("captures/" .. name), vim.fn.shellescape(program) }
					for _, a in ipairs(params.args or {}) do
						parts[#parts + 1] = vim.fn.shellescape(a)
					end
					local script = table.concat(parts, " ")
					if params.open then
						script = script .. "; " .. OPEN_NEWEST
					end
					return {
						cmd = { "sh", "-c", script },
						cwd = opts.dir,
						name = "renderdoc_capture " .. name,
						components = { "default" },
					}
				end,
			},
			{
				name = "renderdoc_open",
				desc = "Open the newest captures/*.rdc in qrenderdoc",
				tags = { "vulkan", "gpu" },
				builder = function()
					return {
						cmd = { "sh", "-c", OPEN_NEWEST },
						cwd = opts.dir,
						name = "renderdoc_open",
						components = { "default" },
					}
				end,
			},
		})
	end,
}
