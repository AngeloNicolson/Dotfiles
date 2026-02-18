# Flashcards Plugin

A spaced repetition flashcard system for Neovim with two review modes.

## Keybindings

| Key | Action |
|-----|--------|
| `<leader>fc` | Start flashcard review (spaced repetition) |
| `<leader>fd` | Start drill mode (round-based mastery) |
| `<leader>fs` | Show statistics |

## Modes

### Review Mode (`<leader>fc`)

Standard spaced repetition using the SM-2 algorithm.

- Cards are scheduled based on how well you know them
- Rating 1 (Forgot) = see again tomorrow
- Rating 2-4 = intervals increase based on performance
- Cards only appear when they're "due"

**Controls:**
- `Space` - Show answer
- `1-4` - Rate card (1=Forgot, 2=Hard, 3=Good, 4=Easy)
- `a` - Ask AI for help (requires Ollama)
- `q/Esc` - Quit

### Drill Mode (`<leader>fd`)

Round-based forced repetition until mastery. Best for learning new material.

**How it works:**
1. **Round 1**: All cards shuffled, see each card exactly once
2. **After each card**:
   - Press `y` (Yes): Streak +1. If streak < target, card goes to next round
   - Press `n` (No): Streak resets to 0, card goes to next round
3. **Next round**: Only contains cards not yet mastered (shuffled fresh)
4. **Session ends**: When a round completes with all cards mastered

**Mastery requirement:** 2 correct answers in a row (configurable via `drill_target`)

**Controls:**
- `Space` - Show answer
- `y` - Got it right
- `n` - Got it wrong
- `a` - Ask AI for help
- `q/Esc` - Quit

## Deck Format

Decks are tab-separated text files:

```
question	answer
What is 2+2?	4
Capital of France?	Paris
```

- Lines starting with `#` are comments
- Empty lines are ignored
- Store decks in `~/knowledge_vault/Study-Vault/Anki/` (configurable)

## Configuration

In `lua/plugins/flashcards.lua`:

```lua
require("config.flashcards").setup({
  deck_dir = "~/knowledge_vault/Study-Vault/Anki",
  data_file = "~/.local/share/nvim/flashcards_progress.json",
})
```

## State Variables (for development)

```lua
M.state = {
  -- Review mode
  current_deck = nil,      -- current deck path
  cards = {},              -- loaded cards
  current_index = 0,       -- current card index
  showing_answer = false,  -- answer visible?
  progress = {},           -- SM-2 data per card

  -- Drill mode (round-based)
  drill_mode = false,
  drill_round = {},        -- cards in current round
  drill_missed = {},       -- cards for next round
  drill_streak = {},       -- consecutive correct per card
  drill_target = 2,        -- correct answers needed to master
  drill_round_num = 1,     -- current round number

  -- Session tracking
  session_started = false,
  deck_stats = {},         -- completion/abandon stats per deck
}
```

## AI Assistant

Press `a` during review to ask Ollama about the current card.

- Requires Ollama running locally
- Will prompt to select/load a model if none active
- Context includes the current question and answer

## File Structure

```
lua/config/flashcards/
├── init.lua    -- Main plugin code
└── README.md   -- This file
```
