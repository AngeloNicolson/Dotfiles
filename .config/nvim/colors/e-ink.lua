-- E-Ink colorscheme for Neovim
-- Synced with system E-Ink theme (Monochrome, minimal)

local colors = {
  -- Background colors
  bg = "#ffffff",
  bg_dark = "#f5f5f5",
  bg_light = "#eeeeee",
  bg_lighter = "#e0e0e0",

  -- Foreground colors
  fg = "#000000",
  fg_dim = "#555555",
  fg_bright = "#000000",

  -- Accent and semantic colors (monochrome)
  accent = "#333333",
  red = "#000000",
  red_bright = "#333333",
  green = "#000000",
  green_bright = "#333333",
  yellow = "#000000",
  yellow_bright = "#333333",
  blue = "#000000",
  blue_bright = "#333333",
  magenta = "#000000",
  magenta_bright = "#333333",
  cyan = "#000000",
  cyan_bright = "#333333",
  gray = "#888888",
}

-- Clear existing highlights
vim.cmd("highlight clear")
if vim.fn.exists("syntax_on") then
  vim.cmd("syntax reset")
end

vim.o.background = "light"
vim.g.colors_name = "e-ink"

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
hi("CursorLine", { bg = colors.bg_dark })
hi("CursorLineNr", { fg = colors.accent, gui = "bold" })
hi("Visual", { bg = colors.bg_lighter })
hi("VisualNOS", { bg = colors.bg_lighter })
hi("Search", { bg = colors.bg_lighter, gui = "underline" })
hi("IncSearch", { bg = colors.bg_lighter, gui = "bold,underline" })
hi("ColorColumn", { bg = colors.bg_dark })
hi("SignColumn", { bg = colors.bg })
hi("Folded", { fg = colors.fg_dim, bg = colors.bg_light })
hi("FoldColumn", { fg = colors.gray, bg = colors.bg })
hi("VertSplit", { fg = colors.gray })
hi("StatusLine", { fg = colors.fg, bg = colors.bg_light })
hi("StatusLineNC", { fg = colors.fg_dim, bg = colors.bg_dark })
hi("Pmenu", { fg = colors.fg, bg = colors.bg_light })
hi("PmenuSel", { fg = colors.bg, bg = colors.accent })
hi("PmenuSbar", { bg = colors.bg_dark })
hi("PmenuThumb", { bg = colors.gray })

-- Syntax highlights (minimal differentiation for e-ink)
hi("Comment", { fg = colors.gray, gui = "italic" })
hi("Constant", { fg = colors.fg, gui = "bold" })
hi("String", { fg = colors.fg_dim })
hi("Character", { fg = colors.fg_dim })
hi("Number", { fg = colors.fg, gui = "bold" })
hi("Boolean", { fg = colors.fg, gui = "bold" })
hi("Float", { fg = colors.fg, gui = "bold" })

hi("Identifier", { fg = colors.fg })
hi("Function", { fg = colors.fg, gui = "bold" })

hi("Statement", { fg = colors.fg, gui = "bold" })
hi("Conditional", { fg = colors.fg, gui = "bold" })
hi("Repeat", { fg = colors.fg, gui = "bold" })
hi("Label", { fg = colors.fg, gui = "bold" })
hi("Operator", { fg = colors.fg })
hi("Keyword", { fg = colors.fg, gui = "bold" })
hi("Exception", { fg = colors.fg, gui = "bold" })

hi("PreProc", { fg = colors.fg, gui = "bold" })
hi("Include", { fg = colors.fg, gui = "bold" })
hi("Define", { fg = colors.fg, gui = "bold" })
hi("Macro", { fg = colors.fg, gui = "bold" })
hi("PreCondit", { fg = colors.fg, gui = "bold" })

hi("Type", { fg = colors.fg, gui = "bold" })
hi("StorageClass", { fg = colors.fg, gui = "bold" })
hi("Structure", { fg = colors.fg, gui = "bold" })
hi("Typedef", { fg = colors.fg, gui = "bold" })

hi("Special", { fg = colors.accent })
hi("SpecialChar", { fg = colors.accent })
hi("Tag", { fg = colors.fg, gui = "underline" })
hi("Delimiter", { fg = colors.fg_dim })
hi("SpecialComment", { fg = colors.gray, gui = "bold" })
hi("Debug", { fg = colors.accent })

hi("Underlined", { fg = colors.fg, gui = "underline" })
hi("Error", { fg = colors.fg, gui = "bold,underline" })
hi("ErrorMsg", { fg = colors.accent, gui = "bold" })
hi("WarningMsg", { fg = colors.fg_dim, gui = "bold" })
hi("Todo", { fg = colors.fg, bg = colors.bg_lighter, gui = "bold" })

-- Diff highlights
hi("DiffAdd", { bg = colors.bg_lighter, gui = "bold" })
hi("DiffChange", { bg = colors.bg_light })
hi("DiffDelete", { fg = colors.gray, bg = colors.bg_light })
hi("DiffText", { bg = colors.bg_lighter, gui = "bold" })

-- Git signs
hi("GitSignsAdd", { fg = colors.accent })
hi("GitSignsChange", { fg = colors.fg_dim })
hi("GitSignsDelete", { fg = colors.gray })

-- Treesitter highlights
hi("@variable", { fg = colors.fg })
hi("@variable.builtin", { fg = colors.fg, gui = "bold" })
hi("@constant", { fg = colors.fg, gui = "bold" })
hi("@constant.builtin", { fg = colors.fg, gui = "bold" })
hi("@string", { fg = colors.fg_dim })
hi("@number", { fg = colors.fg, gui = "bold" })
hi("@boolean", { fg = colors.fg, gui = "bold" })
hi("@function", { fg = colors.fg, gui = "bold" })
hi("@function.builtin", { fg = colors.fg, gui = "bold" })
hi("@keyword", { fg = colors.fg, gui = "bold" })
hi("@keyword.function", { fg = colors.fg, gui = "bold" })
hi("@keyword.operator", { fg = colors.fg, gui = "bold" })
hi("@operator", { fg = colors.fg })
hi("@punctuation.bracket", { fg = colors.fg_dim })
hi("@punctuation.delimiter", { fg = colors.fg_dim })
hi("@type", { fg = colors.fg, gui = "bold" })
hi("@type.builtin", { fg = colors.fg, gui = "bold" })
hi("@parameter", { fg = colors.fg })
hi("@property", { fg = colors.fg })
hi("@comment", { fg = colors.gray, gui = "italic" })
hi("@tag", { fg = colors.fg, gui = "underline" })
hi("@tag.attribute", { fg = colors.fg })
hi("@tag.delimiter", { fg = colors.fg_dim })

-- LSP highlights
hi("DiagnosticError", { fg = colors.accent, gui = "bold" })
hi("DiagnosticWarn", { fg = colors.fg_dim })
hi("DiagnosticInfo", { fg = colors.fg_dim })
hi("DiagnosticHint", { fg = colors.gray })
hi("DiagnosticUnderlineError", { sp = colors.accent, gui = "underline" })
hi("DiagnosticUnderlineWarn", { sp = colors.fg_dim, gui = "underline" })
hi("DiagnosticUnderlineInfo", { sp = colors.fg_dim, gui = "underline" })
hi("DiagnosticUnderlineHint", { sp = colors.gray, gui = "underline" })

-- Telescope highlights
hi("TelescopeBorder", { fg = colors.gray })
hi("TelescopePromptBorder", { fg = colors.accent })
hi("TelescopeSelection", { fg = colors.fg, bg = colors.bg_light })
hi("TelescopeMatching", { fg = colors.accent, gui = "bold" })

-- NvimTree highlights
hi("NvimTreeNormal", { fg = colors.fg, bg = colors.bg_light })
hi("NvimTreeFolderName", { fg = colors.fg })
hi("NvimTreeFolderIcon", { fg = colors.fg, gui = "bold" })
hi("NvimTreeOpenedFolderName", { fg = colors.fg, gui = "bold" })
hi("NvimTreeRootFolder", { fg = colors.accent, gui = "bold" })
hi("NvimTreeGitDirty", { fg = colors.fg_dim })
hi("NvimTreeGitNew", { fg = colors.accent })
hi("NvimTreeGitDeleted", { fg = colors.gray })
