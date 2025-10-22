# Neovim Configuration

## System Dependencies

These external tools must be installed for full functionality:

### Required
- **Node.js & npm** - Required for LSP servers and some plugins
- **Git** - Version control (should already be installed)
- **ripgrep** - Fast searching (used by Telescope)
- **fd** - Fast file finding (used by Telescope)

### Optional but Recommended
- **lazygit** - Terminal UI for git management
  ```bash
  sudo pacman -S lazygit
  ```

- **Ollama** - Local AI models for gen.nvim
  ```bash
  # Install ollama, then pull a model:
  ollama pull deepseek-coder-v2
  # or
  ollama pull codellama:7b
  ```

### Language-Specific Tools
LSP servers and formatters are auto-installed via Mason, but you may need:
- **Python**: python, pip
- **JavaScript/TypeScript**: node, npm
- **Rust**: rustc, cargo
- **C/C++**: gcc, clang
- **Java**: JDK

## Usage Notes

To exit the chat either type :q or quit in the input box.
