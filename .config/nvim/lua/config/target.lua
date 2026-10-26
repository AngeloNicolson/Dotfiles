-- Launch-target resolution shared by the DAP configs and the Overseer
-- templates: cmake-tools' selected launch target first, then build/Debug/<name>,
-- then a prompt.
local M = {}

---@return string|nil
function M.cmake_launch_target()
	local ok, cmake = pcall(require, "cmake-tools")
	if not ok then
		return nil
	end
	local ok_path, path = pcall(cmake.get_launch_target_path)
	if ok_path and type(path) == "string" and vim.fn.executable(path) == 1 then
		return path
	end
	return nil
end

---@return string|nil
function M.cmake_build_dir()
	local ok, cmake = pcall(require, "cmake-tools")
	if ok and cmake.get_build_directory then
		local ok_dir, dir = pcall(cmake.get_build_directory)
		-- before the first configure cmake-tools still holds the "${variant:buildType}" template
		if ok_dir and dir and dir ~= "" and not tostring(dir):find("${", 1, true) and vim.fn.isdirectory(tostring(dir)) == 1 then
			return tostring(dir)
		end
	end
	local cwd = vim.fn.getcwd()
	for _, d in ipairs({ "build/Debug", "build/debug", "build" }) do
		if vim.fn.isdirectory(cwd .. "/" .. d) == 1 then
			return cwd .. "/" .. d
		end
	end
	return nil
end

---Executables found under the build dir (one level deep), newest first.
---@return string[]
function M.candidates()
	local out, seen = {}, {}
	local function add(path)
		if path ~= "" and not seen[path] and vim.fn.filereadable(path) == 1 and vim.fn.executable(path) == 1 then
			seen[path] = true
			out[#out + 1] = path
		end
	end
	local cwd = vim.fn.getcwd()
	local name = vim.fn.fnamemodify(cwd, ":t")
	for _, p in ipairs({ "build/Debug/" .. name, "build/Debug/" .. name:lower(), "build/" .. name, "build/" .. name:lower() }) do
		add(cwd .. "/" .. p)
	end
	for _, dir in ipairs({ cwd .. "/build/Debug", cwd .. "/build/Release", cwd .. "/build/ASan", cwd .. "/build", cwd }) do
		for _, path in ipairs(vim.fn.glob(dir .. "/*", false, true)) do
			if vim.fn.isdirectory(path) == 0 and not path:match("%.%w+$") then
				add(path)
			end
		end
	end
	return out
end

---Synchronous resolution (DAP `program` callbacks run synchronously).
---@return string
function M.resolve_sync()
	local target = M.cmake_launch_target()
	if target then
		return target
	end
	local cands = M.candidates()
	if #cands > 0 then
		local choices = { "Select executable:" }
		for _, p in ipairs(cands) do
			choices[#choices + 1] = vim.fn.fnamemodify(p, ":~:.")
		end
		local i = vim.fn.inputlist(choices)
		if i >= 1 and i <= #cands then
			return cands[i]
		end
	end
	return vim.fn.input("Executable: ", vim.fn.getcwd() .. "/build/Debug/", "file")
end

---Async resolution via vim.ui.select (used by Overseer templates).
---@param cb fun(path: string|nil)
function M.resolve(cb)
	local target = M.cmake_launch_target()
	if target then
		return cb(target)
	end
	local cands = M.candidates()
	if #cands == 0 then
		return vim.ui.input({ prompt = "Executable: ", default = vim.fn.getcwd() .. "/build/Debug/", completion = "file" }, function(p)
			cb(p and p ~= "" and p or nil)
		end)
	end
	cands[#cands + 1] = "<enter path>"
	vim.ui.select(cands, {
		prompt = "Launch target",
		format_item = function(p)
			return vim.fn.fnamemodify(p, ":~:.")
		end,
	}, function(choice)
		if not choice then
			return cb(nil)
		end
		if choice == "<enter path>" then
			return vim.ui.input({ prompt = "Executable: ", completion = "file" }, function(p)
				cb(p and p ~= "" and p or nil)
			end)
		end
		cb(choice)
	end)
end

---Project probes used by Overseer template conditions.
function M.is_cmake_project(dir)
	return vim.fn.filereadable((dir or vim.fn.getcwd()) .. "/CMakeLists.txt") == 1
end

local SKIP_DIRS = { [".git"] = true, build = true, out = true, third_party = true, external = true, node_modules = true, captures = true, [".cache"] = true }

---Bounded walk (depth 6, skips build/.git/third_party...) looking for any file
---whose extension is in `exts`.
function M.has_files(dir, exts)
	dir = dir or vim.fn.getcwd()
	local want = {}
	for _, e in ipairs(exts) do
		want[e] = true
	end
	local ok, found = pcall(function()
		for name, kind in vim.fs.dir(dir, {
			depth = 6,
			skip = function(d)
				return not SKIP_DIRS[vim.fs.basename(d)]
			end,
		}) do
			if kind == "file" and want[name:match("%.(%w+)$") or ""] then
				return true
			end
		end
		return false
	end)
	return ok and found or false
end

function M.is_cuda_project(dir)
	return M.has_files(dir, { "cu", "cuh" })
end

function M.is_vulkan_project(dir)
	dir = dir or vim.fn.getcwd()
	if M.has_files(dir, { "vert", "frag", "comp", "glsl", "spv" }) then
		return true
	end
	local f = io.open(dir .. "/CMakeLists.txt", "r")
	if f then
		local txt = f:read("*a")
		f:close()
		return txt:lower():find("vulkan", 1, true) ~= nil
	end
	return false
end

return M
