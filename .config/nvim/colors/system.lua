-- Palette-driven colorscheme: reads the current system theme's colours from
-- ~/.config/themes/<name>.json (the same palette AGS feeds to foot, Hyprland
-- and Firefox), so every theme works here without a hand-made scheme.
-- Highlight mapping follows colors/mech.lua.

local THEME_DIR = os.getenv("HOME") .. "/.config/themes"

local function read(path)
	local f = io.open(path, "r")
	if not f then
		return nil
	end
	local s = f:read("*a")
	f:close()
	return s
end

local function current_theme()
	local name = read(THEME_DIR .. "/.current")
	return name and vim.trim(name) or "mech"
end

local function palette(name)
	local ok, data = pcall(vim.json.decode, read(THEME_DIR .. "/" .. name .. ".json") or "")
	if ok and type(data) == "table" and type(data.colors) == "table" and data.colors.bg then
		return data.colors
	end
	return nil
end

-- Fallback = mech, so the scheme still loads without the themes dir.
local fallback = {
	bg = "#1d1f20", bg_dark = "#1d2021", bg_light = "#282828", bg_lighter = "#3c3836",
	fg = "#ebdbb2", fg_dim = "#a89984", fg_bright = "#fbf1c7",
	accent = "#d79921", red = "#cc241d", red_bright = "#fb4934", green = "#98971a", green_bright = "#b8bb26",
	yellow = "#d79921", yellow_bright = "#fabd2f", blue = "#458588", blue_bright = "#83a598",
	magenta = "#b16286", magenta_bright = "#d3869b", cyan = "#689d6a", cyan_bright = "#8ec07c", gray = "#928374",
}

local name = current_theme()
local c = setmetatable(palette(name) or {}, { __index = fallback })

vim.cmd("highlight clear")
if vim.fn.exists("syntax_on") then
	vim.cmd("syntax reset")
end
vim.o.background = "dark"
vim.g.colors_name = "system"
vim.g.system_theme_name = name

local function hi(group, opts)
	vim.api.nvim_set_hl(0, group, opts)
end

-- Editor
hi("Normal", { fg = c.fg, bg = c.bg })
hi("NormalFloat", { fg = c.fg, bg = c.bg_light })
hi("FloatBorder", { fg = c.gray, bg = c.bg_light })
hi("LineNr", { fg = c.gray })
hi("Cursor", { fg = c.bg, bg = c.accent })
hi("KondorLogo", { fg = c.fg_dim })
hi("KondorBars", { fg = c.red })
hi("CursorLine", { bg = c.bg_lighter })
hi("CursorLineNr", { fg = c.accent, bold = true })
hi("Visual", { bg = c.bg_lighter })
hi("VisualNOS", { bg = c.bg_lighter })
hi("Search", { fg = c.bg, bg = c.yellow })
hi("IncSearch", { fg = c.bg, bg = c.yellow_bright })
hi("CurSearch", { fg = c.bg, bg = c.accent })
hi("ColorColumn", { bg = c.bg_light })
hi("SignColumn", { bg = c.bg })
hi("Folded", { fg = c.fg_dim, bg = c.bg_light })
hi("FoldColumn", { fg = c.gray, bg = c.bg })
hi("VertSplit", { fg = c.gray })
hi("WinSeparator", { fg = c.gray })
hi("StatusLine", { fg = c.fg, bg = c.bg_light })
hi("StatusLineNC", { fg = c.fg_dim, bg = c.bg_dark })
hi("Pmenu", { fg = c.fg, bg = c.bg_light })
hi("PmenuSel", { fg = c.bg, bg = c.accent })
hi("PmenuSbar", { bg = c.bg_lighter })
hi("PmenuThumb", { bg = c.gray })
hi("MatchParen", { fg = c.accent, bold = true, underline = true })
hi("NonText", { fg = c.bg_lighter })
hi("Whitespace", { fg = c.bg_lighter })
hi("Title", { fg = c.accent, bold = true })
hi("Directory", { fg = c.blue_bright })
hi("Question", { fg = c.green })
hi("MoreMsg", { fg = c.green })
hi("ModeMsg", { fg = c.fg_dim })
hi("WildMenu", { fg = c.bg, bg = c.accent })
hi("TabLine", { fg = c.fg_dim, bg = c.bg_light })
hi("TabLineSel", { fg = c.fg_bright, bg = c.bg_lighter, bold = true })
hi("TabLineFill", { bg = c.bg_dark })
hi("SpellBad", { sp = c.red, undercurl = true })
hi("SpellCap", { sp = c.yellow, undercurl = true })

-- Syntax
hi("Comment", { fg = c.gray, italic = true })
hi("Constant", { fg = c.magenta })
hi("String", { fg = c.green })
hi("Character", { fg = c.green_bright })
hi("Number", { fg = c.magenta_bright })
hi("Boolean", { fg = c.magenta })
hi("Float", { fg = c.magenta_bright })
hi("Identifier", { fg = c.blue })
hi("Function", { fg = c.blue_bright, bold = true })
hi("Statement", { fg = c.red, bold = true })
hi("Conditional", { fg = c.red })
hi("Repeat", { fg = c.red })
hi("Label", { fg = c.red_bright })
hi("Operator", { fg = c.fg })
hi("Keyword", { fg = c.red, bold = true })
hi("Exception", { fg = c.red_bright })
hi("PreProc", { fg = c.cyan })
hi("Include", { fg = c.cyan })
hi("Define", { fg = c.cyan_bright })
hi("Macro", { fg = c.cyan_bright })
hi("PreCondit", { fg = c.cyan })
hi("Type", { fg = c.yellow, bold = true })
hi("StorageClass", { fg = c.yellow })
hi("Structure", { fg = c.yellow_bright })
hi("Typedef", { fg = c.yellow })
hi("Special", { fg = c.accent })
hi("SpecialChar", { fg = c.magenta_bright })
hi("Tag", { fg = c.blue })
hi("Delimiter", { fg = c.fg_dim })
hi("SpecialComment", { fg = c.gray, bold = true })
hi("Debug", { fg = c.red_bright })
hi("Underlined", { fg = c.blue, underline = true })
hi("Error", { fg = c.red_bright, bg = c.bg_dark })
hi("ErrorMsg", { fg = c.red_bright })
hi("WarningMsg", { fg = c.yellow_bright })
hi("Todo", { fg = c.accent, bg = c.bg_light, bold = true })

-- Diff / git
hi("DiffAdd", { fg = c.green_bright, bg = c.bg_light })
hi("DiffChange", { fg = c.yellow, bg = c.bg_light })
hi("DiffDelete", { fg = c.red, bg = c.bg_light })
hi("DiffText", { fg = c.yellow_bright, bg = c.bg_lighter })
hi("GitSignsAdd", { fg = c.green_bright })
hi("GitSignsChange", { fg = c.yellow })
hi("GitSignsDelete", { fg = c.red })

-- Diagnostics
hi("DiagnosticError", { fg = c.red_bright })
hi("DiagnosticWarn", { fg = c.yellow_bright })
hi("DiagnosticInfo", { fg = c.blue_bright })
hi("DiagnosticHint", { fg = c.cyan_bright })
hi("DiagnosticUnderlineError", { sp = c.red_bright, undercurl = true })
hi("DiagnosticUnderlineWarn", { sp = c.yellow_bright, undercurl = true })
hi("DiagnosticUnderlineInfo", { sp = c.blue_bright, undercurl = true })
hi("DiagnosticUnderlineHint", { sp = c.cyan_bright, undercurl = true })

-- Treesitter / LSP semantic tokens (linked to the groups above)
local links = {
	["@comment"] = "Comment", ["@string"] = "String", ["@string.escape"] = "SpecialChar",
	["@character"] = "Character", ["@number"] = "Number", ["@boolean"] = "Boolean", ["@float"] = "Float",
	["@constant"] = "Constant", ["@constant.builtin"] = "Constant", ["@constant.macro"] = "Macro",
	["@variable"] = "Identifier", ["@variable.builtin"] = "Special", ["@variable.parameter"] = "Identifier",
	["@variable.member"] = "Identifier", ["@property"] = "Identifier", ["@field"] = "Identifier",
	["@function"] = "Function", ["@function.call"] = "Function", ["@function.builtin"] = "Function",
	["@function.macro"] = "Macro", ["@function.method"] = "Function", ["@function.method.call"] = "Function",
	["@constructor"] = "Type", ["@keyword"] = "Keyword", ["@keyword.function"] = "Keyword",
	["@keyword.return"] = "Keyword", ["@keyword.operator"] = "Operator", ["@keyword.import"] = "Include",
	["@keyword.conditional"] = "Conditional", ["@keyword.repeat"] = "Repeat", ["@keyword.exception"] = "Exception",
	["@operator"] = "Operator", ["@punctuation.delimiter"] = "Delimiter", ["@punctuation.bracket"] = "Delimiter",
	["@punctuation.special"] = "Special", ["@type"] = "Type", ["@type.builtin"] = "Type",
	["@type.qualifier"] = "StorageClass", ["@type.definition"] = "Typedef", ["@attribute"] = "PreProc",
	["@module"] = "Structure", ["@namespace"] = "Structure", ["@label"] = "Label", ["@tag"] = "Tag",
	["@tag.attribute"] = "Identifier", ["@tag.delimiter"] = "Delimiter",
	["@markup.heading"] = "Title", ["@markup.strong"] = "Bold", ["@markup.italic"] = "Italic",
	["@markup.link"] = "Underlined", ["@markup.raw"] = "String", ["@markup.list"] = "Special",
	["@lsp.type.class"] = "Type", ["@lsp.type.struct"] = "Type", ["@lsp.type.enum"] = "Type",
	["@lsp.type.interface"] = "Type", ["@lsp.type.typeParameter"] = "Type", ["@lsp.type.namespace"] = "Structure",
	["@lsp.type.function"] = "Function", ["@lsp.type.method"] = "Function", ["@lsp.type.macro"] = "Macro",
	["@lsp.type.variable"] = "Identifier", ["@lsp.type.parameter"] = "Identifier", ["@lsp.type.property"] = "Identifier",
	["@lsp.type.enumMember"] = "Constant", ["@lsp.type.keyword"] = "Keyword", ["@lsp.type.comment"] = "Comment",
}
for group, target in pairs(links) do
	hi(group, { link = target })
end
hi("Bold", { bold = true })
hi("Italic", { italic = true })

-- Telescope / popular plugin groups
hi("TelescopeBorder", { fg = c.gray, bg = c.bg_light })
hi("TelescopeNormal", { fg = c.fg, bg = c.bg_light })
hi("TelescopeSelection", { fg = c.fg_bright, bg = c.bg_lighter, bold = true })
hi("TelescopeMatching", { fg = c.accent, bold = true })
hi("TelescopePromptPrefix", { fg = c.accent })
hi("IndentBlanklineChar", { fg = c.bg_lighter })
hi("IblIndent", { fg = c.bg_lighter })
hi("IblScope", { fg = c.gray })
hi("NvimTreeFolderName", { fg = c.blue_bright })
hi("NvimTreeOpenedFolderName", { fg = c.blue_bright, bold = true })
hi("NvimTreeRootFolder", { fg = c.accent, bold = true })
hi("NeoTreeDirectoryName", { fg = c.blue_bright })
hi("NeoTreeRootName", { fg = c.accent, bold = true })

-- Terminal palette
vim.g.terminal_color_0 = c.bg_light
vim.g.terminal_color_1 = c.red
vim.g.terminal_color_2 = c.green
vim.g.terminal_color_3 = c.yellow
vim.g.terminal_color_4 = c.blue
vim.g.terminal_color_5 = c.magenta
vim.g.terminal_color_6 = c.cyan
vim.g.terminal_color_7 = c.fg
vim.g.terminal_color_8 = c.gray
vim.g.terminal_color_9 = c.red_bright
vim.g.terminal_color_10 = c.green_bright
vim.g.terminal_color_11 = c.yellow_bright
vim.g.terminal_color_12 = c.blue_bright
vim.g.terminal_color_13 = c.magenta_bright
vim.g.terminal_color_14 = c.cyan_bright
vim.g.terminal_color_15 = c.fg_bright
