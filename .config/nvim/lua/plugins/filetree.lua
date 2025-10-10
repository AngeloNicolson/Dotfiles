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
			require("neo-tree").setup({
				filesystem = {
					filtered_items = {
						visible = true, -- Show hidden files
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
						local path = node:get_id()

						-- Check file extension
						local ext = path:match("^.+%.(.+)$")
						if not ext then
							-- No extension, use default open
							require("neo-tree.sources.filesystem.commands").open(state)
							require("neo-tree.command").execute({ action = "close" })
							return
						end

						ext = ext:lower()

						-- PDF files - open with zathura
						if ext == "pdf" then
							vim.fn.jobstart({ "zathura", path }, { detach = true })
							return -- Keep tree open
						end

						-- Media files - open with mpv
						local media_exts = {
							"mp4", "mkv", "avi", "mov", "webm", "flv", "wmv",
							"mp3", "wav", "flac", "ogg", "m4a", "aac",
							"jpg", "jpeg", "png", "gif", "bmp", "webp", "svg",
						}
						for _, media_ext in ipairs(media_exts) do
							if ext == media_ext then
								vim.fn.jobstart({ "mpv", path }, { detach = true })
								return -- Keep tree open
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

