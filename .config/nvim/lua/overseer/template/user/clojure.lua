-- Clojure / JVM helpers:
--   clj_nrepl  : `clj -M:nrepl` in the project root (alias with cider-nrepl in
--                ~/.clojure/deps.edn). Conjure picks up .nrepl-port automatically.
--   jvm_heap   : `jcmd <pid> GC.heap_info` (+ class histogram) for a JVM you pick.
--   jvm_jfr    : `jcmd <pid> JFR.start duration=60s filename=<cwd>/jfr/<ts>.jfr`.
-- PIDs come from `jps -lm` when available, else `pgrep -af clojure.main`.

local function project_root(dir)
	local f = vim.fs.find({ "deps.edn", "project.clj", "bb.edn" }, { upward = true, path = dir })[1]
	return f and vim.fs.dirname(f) or nil
end

local function jvm_processes()
	local procs = {}
	if vim.fn.executable("jps") == 1 then
		for _, line in ipairs(vim.fn.systemlist({ "jps", "-lm" })) do
			local pid, rest = line:match("^(%d+)%s*(.*)$")
			if pid and not rest:match("^sun%.tools%.jps") and not rest:match("Jps") then
				procs[#procs + 1] = { pid = pid, label = pid .. "  " .. rest }
			end
		end
	end
	if #procs == 0 then
		for _, line in ipairs(vim.fn.systemlist({ "pgrep", "-af", "clojure.main" })) do
			local pid, rest = line:match("^(%d+)%s*(.*)$")
			if pid then
				procs[#procs + 1] = { pid = pid, label = pid .. "  " .. rest:sub(1, 90) }
			end
		end
	end
	return procs
end

local function pid_choices()
	local out = {}
	for _, p in ipairs(jvm_processes()) do
		out[#out + 1] = p.label
	end
	return out
end

local function pid_of(choice)
	return (tostring(choice or ""):match("^(%d+)"))
end

local function jcmd()
	return vim.fn.executable("jcmd") == 1 and "jcmd" or vim.fn.exepath("jcmd")
end

---@type overseer.TemplateFileProvider
return {
	cache_key = function(opts)
		return project_root(opts.dir) or opts.dir
	end,
	generator = function(opts, cb)
		local ret = {}
		local root = project_root(opts.dir)
		if root and vim.fn.executable("clj") == 1 then
			ret[#ret + 1] = {
				name = "clj_nrepl",
				desc = "clj -M:nrepl (cider-nrepl) in " .. vim.fn.fnamemodify(root, ":~"),
				tags = { "clojure", "repl" },
				params = {
					alias = { type = "string", desc = "deps.edn alias", default = ":nrepl" },
				},
				builder = function(params)
					return {
						cmd = { "clj", "-M" .. params.alias },
						cwd = root,
						name = "nREPL " .. vim.fn.fnamemodify(root, ":t"),
						components = {
							{ "on_complete_notify", statuses = { "FAILURE" } },
							"on_exit_set_status",
							{ "unique", replace = true },
						},
					}
				end,
			}
		end
		-- jcmd tasks only where they make sense: a Clojure project or a live JVM
		if jcmd() ~= "" and (root or #jvm_processes() > 0) then
			ret[#ret + 1] = {
				name = "jvm_heap",
				desc = "jcmd <pid> GC.heap_info + GC.class_histogram (top 30)",
				tags = { "jvm" },
				params = {
					jvm = { type = "enum", desc = "JVM process", choices = pid_choices, optional = false },
				},
				builder = function(params)
					local pid = pid_of(params.jvm)
					local j = jcmd()
					return {
						cmd = { "sh", "-c", ("%s %s GC.heap_info && %s %s GC.class_histogram | head -n 40"):format(j, pid, j, pid) },
						name = "jvm_heap " .. pid,
						components = { "default", { "open_output", on_start = "always", direction = "dock" } },
					}
				end,
			}
			ret[#ret + 1] = {
				name = "jvm_jfr",
				desc = "jcmd <pid> JFR.start duration=60s → jfr/<ts>.jfr (open with jmc or `jfr print`)",
				tags = { "jvm", "profile" },
				params = {
					jvm = { type = "enum", desc = "JVM process", choices = pid_choices, optional = false },
					duration = { type = "string", desc = "Recording duration", default = "60s" },
					settings = { type = "enum", desc = "JFR settings", choices = { "profile", "default" }, default = "profile" },
				},
				builder = function(params)
					local pid = pid_of(params.jvm)
					local outdir = (root or opts.dir) .. "/jfr"
					vim.fn.mkdir(outdir, "p")
					local file = ("%s/%s-%s.jfr"):format(outdir, os.date("%Y%m%d-%H%M%S"), pid)
					return {
						cmd = {
							jcmd(),
							pid,
							"JFR.start",
							"duration=" .. params.duration,
							"settings=" .. params.settings,
							"filename=" .. file,
						},
						name = "jvm_jfr " .. pid,
						components = { "default", { "open_output", on_start = "always", direction = "dock" } },
					}
				end,
			}
		end
		if #ret == 0 then
			return "No deps.edn/project.clj upward and no jcmd on PATH"
		end
		cb(ret)
	end,
}
