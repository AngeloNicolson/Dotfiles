-- compute-sanitizer tools on the cmake-tools launch target.
-- Output lines look like:
--   ========= Invalid __global__ read of size 4 bytes
--   =========     at 0x1a0 in kernel(float*) ... /path/file.cu:42
-- The errorformat below pulls the file:line pairs into the quickfix list.
local target = require("config.target")

local EFM = table.concat({
	[[%E=========\ %m]], -- start of a report ("========= Invalid ... ")
	[[%C=========%\s%\+at\ 0x%\x%\+\ in\ %f:%l]], -- "at 0x.. in /file.cu:42"
	[[%C=========%\s%\+in\ %f:%l]], -- "in /file.cu:42" (host frames)
	[[%C=========%\s%\+%m]], -- continuation lines
	[[%-G%.%#]],
}, ",")

local tools = {
	{ name = "cuda_memcheck", tool = "memcheck", extra = { "--leak-check", "full" }, desc = "Out-of-bounds / misaligned device memory access, leaks" },
	{ name = "cuda_racecheck", tool = "racecheck", extra = {}, desc = "Shared-memory data races" },
	{ name = "cuda_initcheck", tool = "initcheck", extra = {}, desc = "Uninitialised device global memory reads" },
	{ name = "cuda_synccheck", tool = "synccheck", extra = {}, desc = "Invalid __syncthreads / barrier usage" },
}

local function sanitizer()
	for _, p in ipairs({ "/opt/cuda/bin/compute-sanitizer", "compute-sanitizer" }) do
		if vim.fn.executable(p) == 1 then
			return p
		end
	end
end

---@type overseer.TemplateFileProvider
return {
	cache_key = function(opts)
		return opts.dir
	end,
	generator = function(opts, cb)
		local bin = sanitizer()
		if not bin then
			return "compute-sanitizer not found (CUDA toolkit)"
		end
		if not target.is_cuda_project(opts.dir) then
			return "No .cu/.cuh files under " .. opts.dir
		end
		local ret = {}
		for _, t in ipairs(tools) do
			ret[#ret + 1] = {
				name = t.name,
				desc = "compute-sanitizer --tool " .. t.tool .. ": " .. t.desc,
				tags = { "cuda", "gpu" },
				params = {
					program = { type = "string", desc = "Executable (blank = cmake launch target / pick)", optional = true },
					args = { type = "list", subtype = { type = "string" }, delimiter = " ", desc = "Program args", optional = true, default = {} },
				},
				builder = function(params)
					local program = (params.program and params.program ~= "") and params.program or target.cmake_launch_target() or target.resolve_sync()
					local cmd = { bin, "--tool", t.tool, "--print-limit", "50" }
					vim.list_extend(cmd, t.extra)
					cmd[#cmd + 1] = program
					vim.list_extend(cmd, params.args or {})
					return {
						cmd = cmd,
						cwd = opts.dir,
						name = t.name .. " " .. vim.fn.fnamemodify(program, ":t"),
						components = {
							{ "on_output_quickfix", errorformat = EFM, open_on_match = true, items_only = true },
							"on_exit_set_status",
							"on_complete_notify",
							{ "on_complete_dispose", require_view = { "SUCCESS", "FAILURE" } },
						},
					}
				end,
			}
		end
		cb(ret)
	end,
}
