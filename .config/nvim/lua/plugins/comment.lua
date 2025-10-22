return {
	"numToStr/Comment.nvim",
	event = { "BufReadPre", "BufNewFile" },
	config = function()
		require("Comment").setup({
			-- Add a space between comment and line
			padding = true,
			-- Enable commenting in normal and visual mode
			mappings = {
				basic = true,
				extra = true,
			},
		})
	end,
}
