return {
	{
		"nvim-neo-tree/neo-tree.nvim",
		branch = "v3.x",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-tree/nvim-web-devicons",
			"MunifTanjim/nui.nvim",
		},
		config = function()
			-- File type handlers (extension -> app)
			local external_handlers = {
				-- Documents
				pdf = "zathura",

				-- Videos
				mp4 = "mpv",
				mkv = "mpv",
				avi = "mpv",
				mov = "mpv",
				webm = "mpv",
				flv = "mpv",
				wmv = "mpv",

				-- Audio
				mp3 = "mpv",
				wav = "mpv",
				flac = "mpv",
				ogg = "mpv",
				m4a = "mpv",
				aac = "mpv",

				-- Images
				jpg = "mpv",
				jpeg = "mpv",
				png = "mpv",
				gif = "mpv",
				bmp = "mpv",
				webp = "mpv",
				svg = "mpv",
			}

			-- Helper: launch external app
			-- Adds custom window identifiers for mpv/zathura so Hyprland can pin them
			-- Helper: check if file extension is media (not PDF)
			local function is_media(ext)
				local media_exts = {
					-- Videos
					"mp4", "mkv", "avi", "mov", "webm", "flv", "wmv",
					-- Audio
					"mp3", "wav", "flac", "ogg", "m4a", "aac",
					-- Images
					"jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"
				}
				for _, media_ext in ipairs(media_exts) do
					if ext == media_ext then
						return true
					end
				end
				return false
			end

			local function open_external(app, path)
				local cmd
				local ext = path:match("^.+%.(.+)$")
				if ext then
					ext = ext:lower()
				end

				if app == "mpv" and ext and is_media(ext) then
					-- Add --title flag so Hyprland can identify mpv launched from nvim
					-- Set geometry to 960x540 for 16:9 ratio (wide and short for videos)
					cmd = string.format("setsid -f %s --title=nvim-mpv --geometry=960x540 %s", app, vim.fn.shellescape(path))
				elseif app == "zathura" then
					-- Zathura doesn't support --class, just launch it normally
					-- Hyprland will catch it with the default zathura class
					cmd = string.format("setsid -f %s %s", app, vim.fn.shellescape(path))
				else
					cmd = string.format("setsid -f %s %s", app, vim.fn.shellescape(path))
				end
				vim.fn.jobstart(cmd, {
					detach = true,
					shell = true,
				})
			end

			-- Intercept ALL attempts to open media files in buffers
			-- This ensures consistent behavior regardless of how the file is opened
			vim.api.nvim_create_autocmd("BufReadCmd", {
				pattern = { "*.pdf", "*.mp4", "*.mkv", "*.avi", "*.mov", "*.webm", "*.flv", "*.wmv", "*.mp3", "*.wav", "*.flac", "*.ogg", "*.m4a", "*.aac", "*.jpg", "*.jpeg", "*.png", "*.gif", "*.bmp", "*.webp", "*.svg" },
				callback = function(args)
					local path = vim.fn.fnamemodify(args.file, ":p")
					local ext = path:match("^.+%.(.+)$")
					if ext then
						ext = ext:lower()
						local handler = external_handlers[ext]
						if handler then
							-- Block buffer from being read - BufReadCmd prevents the default buffer loading
							vim.bo[args.buf].buftype = "nofile"
							vim.bo[args.buf].bufhidden = "hide"
							vim.bo[args.buf].swapfile = false
							-- Open in external app
							open_external(handler, path)
							-- Don't wipe buffer - just leave it empty
						end
					end
				end,
			})

			require("neo-tree").setup({
				close_if_last_window = false,
				popup_border_style = "rounded",
				enable_git_status = true,
				enable_diagnostics = true,
				sort_case_insensitive = false,
				-- Natural sorting: splits filenames into text/number segments and compares them properly
				-- This ensures Week_1, Week_2, ..., Week_12 sort correctly instead of Week_1, Week_10, Week_11, Week_12, Week_2
				sort_function = function(a, b)
					if a.type == b.type then
						-- Extract just the filename from the full path
						local function get_filename(path)
							return path:match("([^/]+)$") or path
						end

						local name_a = get_filename(a.path):lower()
						local name_b = get_filename(b.path):lower()

						-- Split filename into alternating text and number chunks
						local function split_natural(str)
							local chunks = {}
							local pos = 1
							while pos <= #str do
								-- Try to match a number
								local num_start, num_end = str:find("%d+", pos)
								if num_start then
									-- Add text before number (if any)
									if num_start > pos then
										table.insert(chunks, { type = "text", value = str:sub(pos, num_start - 1) })
									end
									-- Add number
									table.insert(chunks, { type = "num", value = tonumber(str:sub(num_start, num_end)) })
									pos = num_end + 1
								else
									-- No more numbers, add remaining text
									table.insert(chunks, { type = "text", value = str:sub(pos) })
									break
								end
							end
							return chunks
						end

						local chunks_a = split_natural(name_a)
						local chunks_b = split_natural(name_b)

						-- Compare chunk by chunk
						for i = 1, math.max(#chunks_a, #chunks_b) do
							local chunk_a = chunks_a[i]
							local chunk_b = chunks_b[i]

							-- If one ran out of chunks, it comes first
							if not chunk_a then
								return true
							end
							if not chunk_b then
								return false
							end

							-- Compare same type chunks
							if chunk_a.type == chunk_b.type then
								if chunk_a.value ~= chunk_b.value then
									return chunk_a.value < chunk_b.value
								end
							else
								-- Different types: text comes before numbers
								return chunk_a.type == "text"
							end
						end

						return false -- They're equal
					else
						return a.type < b.type
					end
				end,
				default_component_configs = {
					indent = {
						indent_size = 2,
						padding = 1,
						with_markers = true,
						indent_marker = "│",
						last_indent_marker = "└",
						highlight = "NeoTreeIndentMarker",
					},
					icon = {
						folder_closed = "",
						folder_open = "",
						folder_empty = "",
						default = "",
					},
					git_status = {
						symbols = {
							added = "✚",
							modified = "",
							deleted = "✖",
							renamed = "➜",
							untracked = "★",
							ignored = "◌",
							unstaged = "✗",
							staged = "✓",
							conflict = "",
						},
					},
				},
				window = {
					position = "right",
					width = 40,
					mapping_options = {
						noremap = true,
						nowait = true,
					},
					mappings = {
						["<CR>"] = "custom_open",
						["l"] = "custom_open",
						["h"] = "close_node",
						["H"] = "toggle_hidden",
						["R"] = "refresh",
						["/"] = "fuzzy_finder",
						["f"] = "filter_on_submit",
						["<C-x>"] = "clear_filter",
					},
				},
				filesystem = {
					filtered_items = {
						visible = true,
						hide_dotfiles = false,
						hide_gitignored = false,
						hide_by_name = {
							".git",
							".DS_Store",
							"thumbs.db",
						},
					},
					follow_current_file = {
						enabled = true,
					},
					use_libuv_file_watcher = true,
					group_empty_dirs = false,
					scan_mode = "deep",
				},
				commands = {
					custom_open = function(state)
						local node = state.tree:get_node()

						-- Directories: toggle open/close
						if node.type == "directory" then
							require("neo-tree.sources.filesystem.commands").open(state)
							return
						end

						local path = node:get_id()
						local ext = path:match("^.+%.(.+)$")

						-- Check if extension has external handler
						if ext then
							ext = ext:lower()
							local handler = external_handlers[ext]
							if handler then
								-- Open externally and DON'T open in buffer at all
								open_external(handler, path)
								return
							end
						end

						-- All other files: close tree THEN open in neovim
						vim.schedule(function()
							require("neo-tree.sources.manager").close_all()
							vim.cmd("edit " .. vim.fn.fnameescape(path))
						end)
					end,
				},
			})
		end,
	},
}

