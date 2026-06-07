return {
	"epwalsh/obsidian.nvim",
	version = "*",
	lazy = true,
	ft = "markdown",
	dependencies = {
		"nvim-lua/plenary.nvim",
		"hrsh7th/nvim-cmp",
		"nvim-telescope/telescope.nvim",
		"nvim-treesitter/nvim-treesitter",
	},
	opts = {
		workspaces = {
			{ name = "study",    path = "~/study/knowledge_vault/Study-Vault" },
			{ name = "mindmap",  path = "~/study/knowledge_vault/Angelo-Mind-Map" },
			{ name = "bible",    path = "~/study/knowledge_vault/Bible_Vault" },
		},

		-- Use telescope for pickers
		picker = {
			name = "telescope.nvim",
		},

		-- Daily notes
		daily_notes = {
			folder = "daily",
			date_format = "%Y-%m-%d",
		},

		-- Templates
		templates = {
			folder = "Templates",
			date_format = "%Y-%m-%d",
			time_format = "%H:%M",
		},

		-- Follow markdown links with gf
		follow_url_func = function(url)
			vim.fn.jobstart({ "xdg-open", url })
		end,

		-- Completion
		completion = {
			nvim_cmp = true,
			min_chars = 2,
		},

		-- UI
		ui = {
			enable = true,
			checkboxes = {
				[" "] = { char = "󰄱", hl_group = "ObsidianTodo" },
				["x"] = { char = "", hl_group = "ObsidianDone" },
				[">"] = { char = "", hl_group = "ObsidianRightArrow" },
				["~"] = { char = "󰰱", hl_group = "ObsidianTilde" },
			},
		},
	},
	keys = {
		-- Prefix ownership: <leader>n (Notes)
		{ "<leader>nn", "<cmd>ObsidianNew<cr>",          desc = "New note" },
		{ "<leader>no", "<cmd>ObsidianOpen<cr>",         desc = "Open in Obsidian app" },
		{ "<leader>nf", "<cmd>ObsidianQuickSwitch<cr>",  desc = "Find note" },
		{ "<leader>ns", "<cmd>ObsidianSearch<cr>",       desc = "Search notes" },
		{ "<leader>nb", "<cmd>ObsidianBacklinks<cr>",    desc = "Backlinks" },
		{ "<leader>nt", "<cmd>ObsidianTags<cr>",         desc = "Tags" },
		{ "<leader>nm", "<cmd>ObsidianTemplate<cr>",     desc = "Insert template" },
		{ "<leader>nd", "<cmd>ObsidianToday<cr>",        desc = "Daily note (today)" },
		{ "<leader>ny", "<cmd>ObsidianYesterday<cr>",    desc = "Daily note (yesterday)" },
		{ "<leader>nw", "<cmd>ObsidianWorkspace<cr>",    desc = "Switch workspace" },
		{ "<leader>nl", "<cmd>ObsidianLinks<cr>",        desc = "List links" },
		{ "<leader>ni", "<cmd>ObsidianPasteImg<cr>",     desc = "Paste image" },
		{ "<leader>nk", "<cmd>ObsidianFollowLink<cr>",   desc = "Follow link" },
		{ "<leader>nL", "<cmd>ObsidianLinkNew<cr>",      desc = "Link selection to new note",  mode = "v" },
		{ "<leader>ne", "<cmd>ObsidianExtractNote<cr>",  desc = "Extract selection to note",   mode = "v" },
	},
}
