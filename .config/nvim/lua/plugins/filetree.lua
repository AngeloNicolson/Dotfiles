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
			local function open_external(app, path)
				vim.fn.jobstart(string.format("setsid -f %s %s", app, vim.fn.shellescape(path)), {
					detach = true,
					shell = true,
				})
			end

			require("neo-tree").setup({
				close_if_last_window = false,
				popup_border_style = "rounded",
				enable_git_status = true,
				enable_diagnostics = true,
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
						["l"] = "open",
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
					window = {
						mappings = {
							["<CR>"] = "custom_open",
						},
					},
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
								-- Open externally and KEEP tree open
								open_external(handler, path)
								return
							end
						end

						-- All other files: open in neovim and CLOSE tree
						require("neo-tree.sources.filesystem.commands").open(state)
						vim.schedule(function()
							vim.cmd("Neotree close")
						end)
					end,
				},
			})
		end,
	},
}

