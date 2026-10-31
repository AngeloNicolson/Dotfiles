# Neovim Configuration

Neovim 0.12 + lazy.nvim. C++/Vulkan/CUDA engine work (Kondor) first, Clojure,
Lua, Python and web second. Plugins live in `lua/plugins/*.lua`, one file per
concern; global keymaps in `lua/config/remaps.lua`; which-key groups in
`lua/config/keymaps.lua`.

## Features

- LSP via the native `vim.lsp.config` / `vim.lsp.enable` API (`lua/plugins/lsp.lua`);
  Mason only installs servers. clangd runs with background index, clang-tidy,
  IWYU header insertion and `--query-driver` for g++/clang++/nvcc. Native inlay
  hints are on for every server that supports them (`<leader>li` toggles).
- One AI stack: **CodeCompanion** on the local Ollama (chat/inline/cmd + the
  `/expert` retrieval command over monolith's indexes) and **Minuet** FIM ghost
  text (`qwen2.5-coder:7b`).
- Builds and tasks through **Overseer** (also the cmake-tools executor/runner),
  with GPU-debugging task templates: compute-sanitizer, Vulkan validation layer,
  RenderDoc capture, debug GLSL builds, clang-tidy.
- Debugging with **nvim-dap**: codelldb for C/C++, `cuda-gdb -i dap` for CUDA.
- Clojure: Conjure (no auto JVM) + nvim-paredit, nREPL/jcmd/JFR as Overseer tasks.
- Telescope (also the `vim.ui.select` backend), Treesitter, nvim-cmp, conform,
  Fugitive + Lazygit, yazi, Harpoon, Spectre, Obsidian notes.
- Colorscheme follows the system theme (`~/.config/themes/.current`).

## System Dependencies

Required: `git`, `ripgrep`, `node`/`npm` (markdown-preview, some LSPs), `make`.
Optional: `lazygit`, `yazi`, `ollama` (AI), `monolith` (model select + `/expert`),
`clojure`/`jdk` (`clj`, `jcmd`, `jps`), CUDA toolkit (`/opt/cuda/bin/cuda-gdb`,
`compute-sanitizer`), `renderdoc` (`renderdoccmd`, `qrenderdoc`), `shaderc`
(`glslc`), `clang-tidy`, Vulkan validation layers.

Mason installs the LSP servers listed in `lua/plugins/lsp.lua` plus `stylua`
and `eslint_d`; `codelldb` comes from mason-nvim-dap.

### Ollama models

```bash
ollama pull qwen3.8:27b        # chat (default; pick others with :AIModels)
ollama pull qwen3:8b           # inline edits / :CodeCompanionCmd
ollama pull qwen2.5-coder:7b   # Minuet FIM ghost text
```

## AI

| Key | Mode | Action |
| --- | --- | --- |
| `<leader>ac` | n, v | Toggle CodeCompanion chat (adapter `ollama`, model from `:AIModels`) |
| `<leader>ax` | n, v | CodeCompanion action palette (prompt library) |
| `<leader>ai` | n | Inline prompt (adapter `ollama_fast` = qwen3:8b) |
| `<leader>ai` | v | Inline prompt on the selection |
| `<leader>ag` | n, v | "Debug GPU error" prompt: selection + current diagnostics, engine expert |
| `ga` | v | Add selection to the chat |
| `<leader>am` | n | `:AIModels` — pick the chat model (via `monolith select`) |
| `<leader>aV` | n | Toggle Minuet ghost text |
| `<leader>aC` | n | Toggle Minuet as a cmp source |
| `<A-a>` / `<A-l>` / `<A-z>` | i | Accept ghost text: all / one line / n lines |
| `<A-[>` / `<A-]>` | i | Previous / next ghost-text candidate (also triggers one) |
| `<A-e>` | i | Dismiss ghost text |
| `<A-y>` | i | Ask cmp for a Minuet completion |

In the chat buffer: `/expert <engine|study|setup|code> <question>` (or `ge` /
`<M-e>`) pulls chunks from monolith's indexes into the context; `/gpu` runs the
"Debug GPU error" prompt. The ollama adapters set `think = false` and
`num_ctx = 16384`.

Minuet's `api_key = "TERM"` is deliberate: it wants the *name* of a non-empty
environment variable even for a keyless local server.

## Build and tasks

| Key | Action |
| --- | --- |
| `<leader>bb` / `br` / `bd` / `bt` | CMake build / run / debug / test |
| `<leader>bcg` / `bcb` / `bcr` / `bcd` / `bct` | CMake generate / build / run / debug / test picker |
| `<leader>bcy` / `bcp` / `bcT` / `bcl` | Select build type / configure preset / build target / launch target |
| `<leader>bco` / `bcc` / `bcx` | Open / close Overseer output, stop |
| `<leader>boo` / `bor` / `bob` / `boq` / `boa` | Overseer toggle / run template / build task / quick action / task action |
| `<leader>bx` | Compile and run the current single C/C++ file |

cmake-tools builds into `build/${buildType}` (`Debug`, `Release`, `ASan` presets
from `CMakePresets.json`) and runs everything through Overseer.

### GPU debugging templates (`<leader>bg…`, `lua/overseer/template/user/`)

| Key | Template | What it runs |
| --- | --- | --- |
| `<leader>bgm` | `cuda_memcheck` | `compute-sanitizer --tool memcheck --leak-check full --print-limit 50 <target>` |
| `<leader>bgr` | `cuda_racecheck` | `--tool racecheck` |
| `<leader>bgi` | `cuda_initcheck` | `--tool initcheck` |
| `<leader>bgs` | `cuda_synccheck` | `--tool synccheck` |
| `<leader>bgv` | `vulkan_validate` | target with `VK_INSTANCE_LAYERS=VK_LAYER_KHRONOS_validation`, settings from `~/.config/vulkan/kondor-debug/vk_layer_settings.txt` (gpuav, sync, printf, best practices) |
| `<leader>bgc` | `renderdoc_capture` | `renderdoccmd capture -c captures/<name> <target>`; on exit opens the newest `.rdc` in qrenderdoc |
| `<leader>bgo` | `renderdoc_open` | qrenderdoc on the newest `captures/*.rdc` |
| `<leader>bgg` | `glsl_debug_build` | `glslc -O0 -g --target-env=vulkan1.3` for every shader in `shaders/` |
| `<leader>bgt` | `clang_tidy` | `clang-tidy -p build/Debug <current file>` |

The launch target is cmake-tools' selected launch target when there is one,
else `build/Debug/<project>` or a picker. compute-sanitizer `file:line` frames,
`VUID-…` validation messages, glslc and clang-tidy diagnostics land in the
quickfix list. Templates only show up where they apply (CUDA sources present,
Vulkan project, C/C++ buffer, deps.edn upward).

## Debugging (nvim-dap, `<leader>d…`)

| Key | Action |
| --- | --- |
| `<F5>` / `<leader>dc` | Start (cmake launch target → `build/Debug/<name>` → picker) or continue |
| `<leader>dg` | Launch the target under **cuda-gdb** (DAP) |
| `<F10>` / `<F11>` / `<S-F11>` or `dn` / `di` / `do` | Step over / into / out |
| `<S-F5>` / `<leader>dq`, `<C-F5>` / `<leader>dr` | Stop, restart |
| `<leader>db` / `dB` / `dl` / `dx` | Toggle / conditional / log breakpoint, clear all |
| `<leader>dC` | Run to cursor |
| `<leader>du` / `de` / `df` / `dw` / `da` | UI toggle, eval, float scopes, float watches, add watch |
| `<leader>dR` / `dk` / `dj` | REPL, up / down a frame |

Configurations: `Launch`, `Launch with args`, `Attach` (codelldb) and
`CUDA (cuda-gdb)` for `cpp`/`c`; `cuda` buffers (`*.cu`, `*.cuh`) get the
cuda-gdb launch/attach configs. dap-ui opens and closes with the session.

## Clojure

| Key | Action |
| --- | --- |
| `<leader>cr` | Overseer `clj_nrepl`: `clj -M:nrepl` in the project root (cider-nrepl alias in `~/.clojure/deps.edn`); Conjure connects via `.nrepl-port` |
| `<leader>cj` | `jvm_heap`: `jcmd <pid> GC.heap_info` + class histogram, pid picked from `jps -lm` (fallback `pgrep -af clojure.main`) |
| `<leader>cf` | `jvm_jfr`: `jcmd <pid> JFR.start duration=60s settings=profile filename=jfr/<ts>.jfr` |
| `,ee` / `,er` / `,eb` / `,lv` | Conjure: eval form / root form / buffer, open log |
| `>)` `<)` `>(` `<(` | paredit slurp/barf |
| `>e` `<e` `>f` `<f` | paredit drag element / form |
| `,o` / `,O` / `,@` | paredit raise form / element, splice |

Conjure never starts a JVM on its own (`auto_repl` disabled).

## Language (LSP)

`gd` / `gr` / `gI` / `gD` definitions, references, implementations, declaration;
`K` hover; `<leader>ld` / `ls` / `lS` type definition, document / workspace
symbols; `<leader>lr` rename; `<leader>la` code action; `<leader>li` inlay
hints; `<leader>lf` format (conform, not the server); `<leader>lch` switch
source/header, `lca` AST, `lct` type hierarchy, `lcs` symbol info, `lcm` memory
usage (clangd); `<leader>lgd` Doxygen comment.

## Other keys

- Search: `<leader>sf` files, `<C-p>` git files, `<leader>sg` grep prompt,
  `<leader>sl` live grep, `<leader>sm` media, `<leader>sr` / `sw` / `sp` Spectre.
- Files: `<leader>fe` / `fE` yazi, `<leader>fx` netrw, `<leader>fja` / `fjm` +
  `<C-e>` / `<C-j>` / `<C-k>` Harpoon, `<leader>oo` / `oh` / `ov` other file.
- Git: `<leader>gs` fugitive, `<leader>gg` / `gf` / `gc` lazygit.
- Diagnostics: `<leader>xx` / `xX` / `xl` / `xq` / `xs` Trouble, `<leader>xt` / `xT` todos.
- Help: `<leader>hk` / `hc` / `hh` keymaps / commands / help, `<leader>he` / `hm`
  Noice errors / history, `<leader>hb` buffer keymaps.
- Windows/tools: `<leader>wp` colour picker, `<leader>wh` colour highlight,
  `<leader>wu` undotree. Native `<C-w>` is the window prefix.
- Clipboard: `<leader>cy` / `cY` / `cp` / `cP`.
- Notes (`<leader>n…`): Obsidian.

## Themes

The scheme follows `~/.config/themes/.current` (written by AGS) and reloads
live. Hand-made schemes: `halo` (`colors/halo.lua`, Halo / Xbox green: lime
functions, Cortana-blue types, visor-gold strings, Xbox-green keywords) and
`mech`; every other theme (kit, indy, halloween) is built from its JSON
palette by `colors/system.lua`. `:ReloadSystemTheme`
forces a reload.

`~/.config/themes/halo.json` is the matching system theme (AGS, Hyprland, foot,
GTK), discovered by AGS automatically.

## Startup

Heavy plugins (dap, telescope, overseer, spectre, fugitive, harpoon, ccc,
codecompanion, cmake-tools, clangd extensions) load on their keys/commands/
filetypes. `nvim --startuptime` is the number to watch.
