-- Mech colorscheme for Neovim
-- Synced with system Mech theme (Gruvbox-inspired)

local colors = {
  -- Background colors
  bg = "#1d1f20",
  bg_dark = "#1d2021",
  bg_light = "#282828",
  bg_lighter = "#3c3836",

  -- Foreground colors
  fg = "#ebdbb2",
  fg_dim = "#a89984",
  fg_bright = "#fbf1c7",

  -- Accent and semantic colors
  accent = "#d79921",
  red = "#cc241d",
  red_bright = "#fb4934",
  green = "#98971a",
  green_bright = "#b8bb26",
  yellow = "#d79921",
  yellow_bright = "#fabd2f",
  blue = "#458588",
  blue_bright = "#83a598",
  magenta = "#b16286",
  magenta_bright = "#d3869b",
  cyan = "#689d6a",
  cyan_bright = "#8ec07c",
  gray = "#928374",
}

-- Clear existing highlights
vim.cmd("highlight clear")
if vim.fn.exists("syntax_on") then
  vim.cmd("syntax reset")
end

vim.o.background = "dark"
vim.g.colors_name = "mech"

-- Helper function to set highlights
local function hi(group, opts)
  local cmd = "highlight " .. group
  if opts.fg then cmd = cmd .. " guifg=" .. opts.fg end
  if opts.bg then cmd = cmd .. " guibg=" .. opts.bg end
  if opts.gui then cmd = cmd .. " gui=" .. opts.gui end
  if opts.sp then cmd = cmd .. " guisp=" .. opts.sp end
  vim.cmd(cmd)
end

-- Editor highlights
hi("Normal", { fg = colors.fg, bg = colors.bg })
hi("NormalFloat", { fg = colors.fg, bg = colors.bg_light })
hi("FloatBorder", { fg = colors.gray, bg = colors.bg_light })
hi("LineNr", { fg = colors.gray })
hi("Cursor", { fg = colors.bg, bg = colors.accent })
hi("CursorLine", { bg = colors.bg_lighter })
hi("CursorLineNr", { fg = colors.accent, gui = "bold" })
hi("Visual", { bg = colors.bg_lighter })
hi("VisualNOS", { bg = colors.bg_lighter })
hi("Search", { fg = colors.bg, bg = colors.yellow })
hi("IncSearch", { fg = colors.bg, bg = colors.yellow_bright })
hi("ColorColumn", { bg = colors.bg_light })
hi("SignColumn", { bg = colors.bg })
hi("Folded", { fg = colors.fg_dim, bg = colors.bg_light })
hi("FoldColumn", { fg = colors.gray, bg = colors.bg })
hi("VertSplit", { fg = colors.gray })
hi("StatusLine", { fg = colors.fg, bg = colors.bg_light })
hi("StatusLineNC", { fg = colors.fg_dim, bg = colors.bg_dark })
hi("Pmenu", { fg = colors.fg, bg = colors.bg_light })
hi("PmenuSel", { fg = colors.bg, bg = colors.accent })
hi("PmenuSbar", { bg = colors.bg_lighter })
hi("PmenuThumb", { bg = colors.gray })

-- Syntax highlights
hi("Comment", { fg = colors.gray, gui = "italic" })
hi("Constant", { fg = colors.magenta })
hi("String", { fg = colors.green })
hi("Character", { fg = colors.green_bright })
hi("Number", { fg = colors.magenta_bright })
hi("Boolean", { fg = colors.magenta })
hi("Float", { fg = colors.magenta_bright })

hi("Identifier", { fg = colors.blue })
hi("Function", { fg = colors.blue_bright, gui = "bold" })

hi("Statement", { fg = colors.red, gui = "bold" })
hi("Conditional", { fg = colors.red })
hi("Repeat", { fg = colors.red })
hi("Label", { fg = colors.red_bright })
hi("Operator", { fg = colors.fg })
hi("Keyword", { fg = colors.red, gui = "bold" })
hi("Exception", { fg = colors.red_bright })

hi("PreProc", { fg = colors.cyan })
hi("Include", { fg = colors.cyan })
hi("Define", { fg = colors.cyan_bright })
hi("Macro", { fg = colors.cyan_bright })
hi("PreCondit", { fg = colors.cyan })

hi("Type", { fg = colors.yellow, gui = "bold" })
hi("StorageClass", { fg = colors.yellow })
hi("Structure", { fg = colors.yellow_bright })
hi("Typedef", { fg = colors.yellow })

hi("Special", { fg = colors.accent })
hi("SpecialChar", { fg = colors.magenta_bright })
hi("Tag", { fg = colors.blue })
hi("Delimiter", { fg = colors.fg_dim })
hi("SpecialComment", { fg = colors.gray, gui = "bold" })
hi("Debug", { fg = colors.red_bright })

hi("Underlined", { fg = colors.blue, gui = "underline" })
hi("Error", { fg = colors.red_bright, bg = colors.bg_dark })
hi("ErrorMsg", { fg = colors.red_bright })
hi("WarningMsg", { fg = colors.yellow_bright })
hi("Todo", { fg = colors.accent, bg = colors.bg_light, gui = "bold" })

-- Diff highlights
hi("DiffAdd", { fg = colors.green_bright, bg = colors.bg_light })
hi("DiffChange", { fg = colors.yellow, bg = colors.bg_light })
hi("DiffDelete", { fg = colors.red, bg = colors.bg_light })
hi("DiffText", { fg = colors.yellow_bright, bg = colors.bg_lighter })

-- Git signs
hi("GitSignsAdd", { fg = colors.green_bright })
hi("GitSignsChange", { fg = colors.yellow })
hi("GitSignsDelete", { fg = colors.red })

-- Treesitter highlights
hi("@variable", { fg = colors.fg })
hi("@variable.builtin", { fg = colors.magenta })
hi("@constant", { fg = colors.magenta })
hi("@constant.builtin", { fg = colors.magenta_bright })
hi("@string", { fg = colors.green })
hi("@number", { fg = colors.magenta_bright })
hi("@boolean", { fg = colors.magenta })
hi("@function", { fg = colors.blue_bright, gui = "bold" })
hi("@function.builtin", { fg = colors.blue })
hi("@keyword", { fg = colors.red, gui = "bold" })
hi("@keyword.function", { fg = colors.red })
hi("@keyword.operator", { fg = colors.red })
hi("@operator", { fg = colors.fg })
hi("@punctuation.bracket", { fg = colors.fg_dim })
hi("@punctuation.delimiter", { fg = colors.fg_dim })
hi("@type", { fg = colors.yellow, gui = "bold" })
hi("@type.builtin", { fg = colors.yellow_bright })
hi("@parameter", { fg = colors.fg })
hi("@property", { fg = colors.cyan })
hi("@comment", { fg = colors.gray, gui = "italic" })
hi("@tag", { fg = colors.blue })
hi("@tag.attribute", { fg = colors.cyan })
hi("@tag.delimiter", { fg = colors.fg_dim })

-- LSP highlights
hi("DiagnosticError", { fg = colors.red_bright })
hi("DiagnosticWarn", { fg = colors.yellow_bright })
hi("DiagnosticInfo", { fg = colors.blue_bright })
hi("DiagnosticHint", { fg = colors.cyan_bright })
hi("DiagnosticUnderlineError", { sp = colors.red_bright, gui = "underline" })
hi("DiagnosticUnderlineWarn", { sp = colors.yellow_bright, gui = "underline" })
hi("DiagnosticUnderlineInfo", { sp = colors.blue_bright, gui = "underline" })
hi("DiagnosticUnderlineHint", { sp = colors.cyan_bright, gui = "underline" })

-- Telescope highlights
hi("TelescopeBorder", { fg = colors.gray })
hi("TelescopePromptBorder", { fg = colors.accent })
hi("TelescopeSelection", { fg = colors.fg, bg = colors.bg_light })
hi("TelescopeMatching", { fg = colors.accent, gui = "bold" })

-- NvimTree highlights
hi("NvimTreeNormal", { fg = colors.fg, bg = colors.bg_light })
hi("NvimTreeFolderName", { fg = colors.blue })
hi("NvimTreeFolderIcon", { fg = colors.blue_bright })
hi("NvimTreeOpenedFolderName", { fg = colors.blue_bright, gui = "bold" })
hi("NvimTreeRootFolder", { fg = colors.accent, gui = "bold" })
hi("NvimTreeGitDirty", { fg = colors.yellow })
hi("NvimTreeGitNew", { fg = colors.green_bright })
hi("NvimTreeGitDeleted", { fg = colors.red })

-- NeoTree highlights
hi("NeoTreeNormal", { fg = colors.fg, bg = colors.bg_dark })
hi("NeoTreeNormalNC", { fg = colors.fg, bg = colors.bg_dark })
hi("NeoTreeEndOfBuffer", { fg = colors.bg_dark, bg = colors.bg_dark })
hi("NeoTreeDirectoryName", { fg = colors.blue })
hi("NeoTreeDirectoryIcon", { fg = colors.blue_bright })
hi("NeoTreeFileName", { fg = colors.fg })
hi("NeoTreeFileIcon", { fg = colors.fg_dim })
hi("NeoTreeRootName", { fg = colors.accent, gui = "bold" })
hi("NeoTreeIndentMarker", { fg = colors.bg_lighter })
hi("NeoTreeExpander", { fg = colors.gray })
hi("NeoTreeFloatBorder", { fg = colors.gray, bg = colors.bg_dark })
hi("NeoTreeFloatTitle", { fg = colors.accent, bg = colors.bg_dark })
hi("NeoTreeTitleBar", { fg = colors.bg, bg = colors.accent })
hi("NeoTreeCursorLine", { bg = colors.bg_light })
-- NeoTree Git status
hi("NeoTreeGitAdded", { fg = colors.green_bright })
hi("NeoTreeGitConflict", { fg = colors.red_bright })
hi("NeoTreeGitDeleted", { fg = colors.red })
hi("NeoTreeGitIgnored", { fg = colors.gray })
hi("NeoTreeGitModified", { fg = colors.yellow })
hi("NeoTreeGitUnstaged", { fg = colors.yellow })
hi("NeoTreeGitUntracked", { fg = colors.cyan })
hi("NeoTreeGitStaged", { fg = colors.green })
