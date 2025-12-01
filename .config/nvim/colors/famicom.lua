-- Famicom colorscheme for Neovim
-- Synced with system Famicom theme

local colors = {
  -- Background colors
  bg = "#e8e4d9",
  bg_dark = "#d8d4c9",
  bg_light = "#f0ece1",
  bg_lighter = "#f8f4e9",

  -- Foreground colors
  fg = "#2a2420",
  fg_dim = "#5a5450",
  fg_bright = "#1a1410",

  -- Accent and semantic colors
  accent = "#8b2942",
  red = "#8b2942",
  red_bright = "#a83350",
  green = "#3a6830",
  green_bright = "#4a8840",
  yellow = "#c8a030",
  yellow_bright = "#e8c040",
  blue = "#3058c8",
  blue_bright = "#4068e8",
  magenta = "#883088",
  magenta_bright = "#a840a8",
  cyan = "#308888",
  cyan_bright = "#40a8a8",
  gray = "#a09890",
}

-- Clear existing highlights
vim.cmd("highlight clear")
if vim.fn.exists("syntax_on") then
  vim.cmd("syntax reset")
end

vim.o.background = "light"
vim.g.colors_name = "famicom"

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
hi("CursorLine", { bg = colors.bg_light })
hi("CursorLineNr", { fg = colors.accent, gui = "bold" })
hi("Visual", { bg = colors.bg_dark })
hi("VisualNOS", { bg = colors.bg_dark })
hi("Search", { fg = colors.bg, bg = colors.yellow })
hi("IncSearch", { fg = colors.bg, bg = colors.yellow_bright })
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
hi("DiffText", { fg = colors.yellow_bright, bg = colors.bg_dark })

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

-- Lualine integration (set via config, but define colors here for reference)
vim.g.famicom_colors = colors
