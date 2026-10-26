-- glslc -O0 -g for every shader under the project's shader dir, so RenderDoc
-- shows source-level GLSL. Errors (file:line: error: msg) land in quickfix.
local target = require("config.target")

local STAGES = { vert = true, frag = true, comp = true, geom = true, tesc = true, tese = true, rgen = true, rchit = true, rmiss = true, rahit = true, rint = true, mesh = true, task = true }

local function shader_dir(dir)
	for _, d in ipairs({ "shaders", "assets/shaders", "res/shaders", "src/shaders" }) do
		if vim.fn.isdirectory(dir .. "/" .. d) == 1 then
			return dir .. "/" .. d
		end
	end
end

---@type overseer.TemplateFileProvider
return {
	cache_key = function(opts)
		return opts.dir
	end,
	generator = function(opts, cb)
		if vim.fn.executable("glslc") == 0 then
			return "glslc not found (shaderc)"
		end
		local sdir = shader_dir(opts.dir)
		if not sdir and not target.is_vulkan_project(opts.dir) then
			return "No shader dir found"
		end
		cb({
			{
				name = "glsl_debug_build",
				desc = "glslc -O0 -g every *.vert/*.frag/*.comp... in the shader dir to *.spv",
				tags = { "vulkan", "gpu", "build" },
				params = {
					dir = { type = "string", desc = "Shader directory", default = sdir or opts.dir },
					out = { type = "string", desc = "Output dir (blank = next to source)", optional = true, default = "" },
					target_env = { type = "string", desc = "--target-env", default = "vulkan1.3" },
				},
				builder = function(params)
					local files = {}
					for _, f in ipairs(vim.fn.glob(params.dir .. "/**/*", false, true)) do
						local ext = f:match("%.(%w+)$")
						if ext and STAGES[ext] then
							files[#files + 1] = f
						end
					end
					local script = {}
					for _, f in ipairs(files) do
						local out = (params.out and params.out ~= "") and (params.out .. "/" .. vim.fn.fnamemodify(f, ":t") .. ".spv") or (f .. ".spv")
						script[#script + 1] = ("glslc -O0 -g --target-env=%s %s -o %s"):format(
							params.target_env,
							vim.fn.shellescape(f),
							vim.fn.shellescape(out)
						)
					end
					if params.out and params.out ~= "" then
						table.insert(script, 1, "mkdir -p " .. vim.fn.shellescape(params.out))
					end
					return {
						cmd = { "sh", "-c", #script > 0 and table.concat(script, " && ") or "echo no shaders found" },
						cwd = opts.dir,
						name = ("glsl_debug_build (%d shaders)"):format(#files),
						components = {
							{ "on_output_quickfix", errorformat = [[%f:%l:\ %trror:\ %m,%f:%l:\ %tarning:\ %m]], open_on_match = true, items_only = true },
							"default",
						},
					}
				end,
			},
		})
	end,
}
