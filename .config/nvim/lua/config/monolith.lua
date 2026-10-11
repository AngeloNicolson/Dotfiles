-- Bridge to monolith's retrieval experts (engine / study / setup / code).
-- `/expert` in a CodeCompanion chat asks for "<expert> <question>", runs
-- `monolith search --json` and adds the retrieved chunks to the chat as
-- context, so the local model answers from your actual notes/config/code.
local M = {}

local MONOLITH = vim.fn.exepath("monolith")
local K = 6

-- Names from `monolith index` ("* engine  desc" / "  study (not built) desc").
local function experts()
	if MONOLITH == "" then
		return {}, nil
	end
	local lines = vim.fn.systemlist({ MONOLITH, "index" })
	if vim.v.shell_error ~= 0 then
		return {}, nil
	end
	local names, current = {}, nil
	for _, line in ipairs(lines) do
		local mark, name = line:match("^(.)%s+(%S+)")
		if name then
			names[#names + 1] = name
			if mark == "*" then
				current = name
			end
		end
	end
	return names, current
end

-- Which expert fits the buffer the chat was opened from.
function M.default_index(bufnr)
	local path = vim.api.nvim_buf_get_name(bufnr or 0)
	local ft = vim.bo[bufnr or 0].filetype
	if path:find("knowledge_vault", 1, true) or path:find("/study/", 1, true) then
		return "study"
	end
	if path:find("/dotfiles/", 1, true) or path:find("/.config/", 1, true) or path:find("/memory/", 1, true) then
		return "setup"
	end
	if ft == "markdown" or ft == "text" then
		return "study"
	end
	return "code"
end

local function fence(hit)
	-- Code/config chunks carry their path in the label; the model infers the language.
	return (hit.kind == "code" or hit.kind == "config") and "" or "text"
end

---@param chat table CodeCompanion chat
---@param index string
---@param query string
function M.retrieve(chat, index, query)
	if MONOLITH == "" then
		return vim.notify("monolith not found on PATH", vim.log.levels.ERROR, { title = "Expert" })
	end
	vim.system(
		{ MONOLITH, "search", "--json", "--index", index, "-k", tostring(K), query },
		{ text = true },
		function(res)
			vim.schedule(function()
				if res.code ~= 0 then
					return vim.notify(vim.trim(res.stderr or "monolith search failed"), vim.log.levels.ERROR, { title = "Expert" })
				end
				local ok, hits = pcall(vim.json.decode, res.stdout)
				if not ok or type(hits) ~= "table" or #hits == 0 then
					return vim.notify(("nothing found in `%s` for: %s"):format(index, query), vim.log.levels.WARN, { title = "Expert" })
				end
				local parts = {
					("SOURCES retrieved from the `%s` expert for the question %q. Use the ones that answer; ignore the rest; cite as [n]."):format(
						index,
						query
					),
				}
				local labels = {}
				for i, h in ipairs(hits) do
					parts[#parts + 1] = ("[%d] %s\n```%s\n%s\n```"):format(i, h.label, fence(h), h.text)
					labels[#labels + 1] = ("[%d] %s"):format(i, h.label)
				end
				local id = ("<expert>%s: %s</expert>"):format(index, query)
				chat:add_context({ role = "user", content = table.concat(parts, "\n\n") }, "expert", id, {
					visible = false,
					tag = "expert",
				})
				vim.notify(table.concat(labels, "\n"), vim.log.levels.INFO, { title = "Expert " .. index })
			end)
		end
	)
end

-- CodeCompanion slash command callback.
function M.slash(chat)
	local names = experts()
	local default = M.default_index(chat.context and chat.context.bufnr or 0)
	vim.ui.input({
		prompt = ("Expert (%s): "):format(table.concat(names, "|")),
		default = default .. " ",
	}, function(input)
		if not input or vim.trim(input) == "" then
			return
		end
		local index, query = input:match("^(%S+)%s+(.+)$")
		if not (index and vim.tbl_contains(names, index)) then
			index, query = default, vim.trim(input)
		end
		M.retrieve(chat, index, vim.trim(query))
	end)
end

return M
