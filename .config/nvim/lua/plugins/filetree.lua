return {
	{
		"mikavilpas/yazi.nvim",
		-- Prefix ownership: <leader>f (Files)
		event = "VeryLazy",
		dependencies = { "nvim-lua/plenary.nvim" },
		keys = {
			{ "<leader>fe", "<cmd>Yazi<cr>", desc = "Files yazi current file" },
			{ "<leader>fE", "<cmd>Yazi cwd<cr>", desc = "Files yazi cwd" },
		},
		opts = {
			open_for_directories = true,
		},
		config = function(_, opts)
			-- External file handlers (extension -> app)
			local external_handlers = {
				pdf = "zathura", rnote = "rnote",
				mp4 = "mpv", mkv = "mpv", avi = "mpv", mov = "mpv", webm = "mpv", flv = "mpv", wmv = "mpv",
				mp3 = "mpv", wav = "mpv", flac = "mpv", ogg = "mpv", m4a = "mpv", aac = "mpv",
				jpg = "mpv", jpeg = "mpv", png = "mpv", gif = "mpv", bmp = "mpv", webp = "mpv", svg = "mpv",
			}

			local function is_media(ext)
				local media_exts = {
					"mp4", "mkv", "avi", "mov", "webm", "flv", "wmv",
					"mp3", "wav", "flac", "ogg", "m4a", "aac",
					"jpg", "jpeg", "png", "gif", "bmp", "webp", "svg",
				}
				for _, e in ipairs(media_exts) do
					if ext == e then return true end
				end
				return false
			end

			local function open_external(app, path)
				local cmd
				local ext = path:match("^.+%.(.+)$")
				if ext then ext = ext:lower() end
				if app == "mpv" and ext and is_media(ext) then
					cmd = string.format("setsid -f %s --title=nvim-mpv --geometry=960x540 %s", app, vim.fn.shellescape(path))
				else
					cmd = string.format("setsid -f %s %s", app, vim.fn.shellescape(path))
				end
				vim.fn.jobstart(cmd, { detach = true, shell = true })
			end

			local default_open_file = require("yazi.openers").open_file

			opts.open_file_function = function(chosen_file, config, state)
				local ext = chosen_file:match("^.+%.(.+)$")
				if ext then
					ext = ext:lower()
					local handler = external_handlers[ext]
					if handler then
						open_external(handler, chosen_file)
						return
					end
				end

				default_open_file(chosen_file, config, state)
			end

			require("yazi").setup(opts)
		end,
	},
}
