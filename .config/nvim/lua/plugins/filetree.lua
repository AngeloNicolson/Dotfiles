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
				vim.fn.jobstart({ app, path }, { detach = true })
			end

			require("neo-tree").setup({
				filesystem = {
					filtered_items = {
						visible = true,
						hide_dotfiles = false,
						hide_gitignored = false,
					},
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
						local filename = path:match("^.+/(.+)$") or path

						-- Check if extension has external handler
						if ext then
							ext = ext:lower()
							local handler = external_handlers[ext]
							if handler then
								print("Opened " .. filename .. " with " .. handler)
								open_external(handler, path)
								return -- Don't open in neovim
							end
						end

						-- Default: open in neovim and close tree
						require("neo-tree.sources.filesystem.commands").open(state)
						require("neo-tree.command").execute({ action = "close" })
					end,
				},
			})
		end,
	},
}

