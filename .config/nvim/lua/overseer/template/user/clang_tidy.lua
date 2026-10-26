-- clang-tidy on the current file with the compile database from build/Debug
-- (or cmake-tools' build dir). Results go to quickfix.
local target = require("config.target")

---@type overseer.TemplateFileProvider
return {
	condition = { filetype = { "c", "cpp", "cuda", "objc", "objcpp" } },
	generator = function(opts, cb)
		if vim.fn.executable("clang-tidy") == 0 then
			return "clang-tidy not found"
		end
		cb({
			{
				name = "clang_tidy",
				desc = "clang-tidy -p <build dir> on the current file",
				tags = { "lint" },
				params = {
					build_dir = {
						type = "string",
						desc = "Directory with compile_commands.json",
						default = target.cmake_build_dir() or (opts.dir .. "/build/Debug"),
					},
					checks = { type = "string", desc = "--checks (blank = .clang-tidy)", optional = true, default = "" },
				},
				builder = function(params)
					local file = vim.api.nvim_buf_get_name(0)
					local cmd = { "clang-tidy", "-p", params.build_dir }
					if params.checks and params.checks ~= "" then
						cmd[#cmd + 1] = "--checks=" .. params.checks
					end
					cmd[#cmd + 1] = file
					return {
						cmd = cmd,
						cwd = opts.dir,
						name = "clang-tidy " .. vim.fn.fnamemodify(file, ":t"),
						components = {
							{ "on_output_quickfix", errorformat = [[%f:%l:%c:\ %trror:\ %m,%f:%l:%c:\ %tarning:\ %m,%f:%l:%c:\ %tote:\ %m]], open_on_match = true, items_only = true },
							"default",
						},
					}
				end,
			},
		})
	end,
}
