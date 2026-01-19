return {
  dir = "~/.config/nvim/lua/config/flashcards",
  name = "flashcards",
  lazy = false,
  config = function()
    require("config.flashcards").setup({
      deck_dir = "~/knowledge_vault/Study-Vault/Anki",
      data_file = "~/.local/share/nvim/flashcards_progress.json",
    })
  end,
  keys = {
    { "<leader>fc", "<cmd>FlashcardStart<cr>", desc = "Start flashcard review" },
    { "<leader>fd", "<cmd>FlashcardDrill<cr>", desc = "Drill mode (forced repetition)" },
    { "<leader>fs", "<cmd>FlashcardStats<cr>", desc = "Show stats" },
  },
}
