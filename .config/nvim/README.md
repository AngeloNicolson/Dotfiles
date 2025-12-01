# Neovim Configuration

## Features

- LSP integration with Mason for automatic server installation
- AI coding assistants (CodeCompanion, Avante) via Ollama
- Fuzzy finding with Telescope
- Syntax highlighting with Treesitter
- Auto-completion with nvim-cmp
- Git integration (Fugitive, Lazygit)
- File tree navigation
- Automatic formatting and linting
- Theme synchronization with system theme

## System Dependencies

### Required
- **Node.js & npm** - LSP servers and plugins
- **Git** - Version control
- **ripgrep** - Fast searching (Telescope)
- **fd** - Fast file finding (Telescope)

### Optional
- **lazygit** - Terminal UI for git management
- **Ollama** - Local AI models for coding assistance

### Language Tools
LSP servers and formatters are auto-installed via Mason. Language runtimes may be needed:
- **Python**: python, pip
- **JavaScript/TypeScript**: node, npm
- **Rust**: rustc, cargo
- **C/C++**: gcc, clang

## Theme Synchronization

Neovim automatically loads the system theme on startup by reading `~/.config/themes/.current`.

Available themes:
- `mech` - Dark gruvbox-inspired theme
- `famicom` - Light retro gaming theme
- `e-ink` - Monochrome high-contrast theme

To reload theme after system change:
```vim
:ReloadSystemTheme
```

## Key Bindings

Leader key: `Space`

### AI Assistants
- `Space cc` - Toggle CodeCompanion chat
- `Space ci` - Inline code generation
- `Space ca` - Code actions menu
- `Space aa` - Avante sidebar
- `Space ae` - AI edit selection (visual mode)

### File Navigation
- `Space pf` - Find files (Telescope)
- `Space ps` - Search in files (grep)
- `Space pv` - File explorer
- `Ctrl-p` - Find files (git)

### Git
- `Space gs` - Git status (Fugitive)
- `Space gg` - Lazygit

### Window Management
- `Ctrl-h/j/k/l` - Navigate windows

See `lua/config/remaps.lua` for complete key bindings.
