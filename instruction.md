# GitHub Copilot Instruction File
# Developer / GitHub ID: Aishwaryahr16
# Repository: https://github.com/Aishwaryahr16/github-copilot-python
# ──────────────────────────────────────────────────────────────
# This file guides GitHub Copilot's behavior for this project.
# It provides clear, contextual direction to influence Copilot's
# output and code style throughout the Sudoku refactoring project.
# ──────────────────────────────────────────────────────────────

## Project Overview

This is a Python Flask Sudoku game refactoring project by **Aishwaryahr16** for the Udacity GitHub Copilot course.
The goal is to refactor legacy code using GitHub Copilot (Ask, Edit, Agent modes) to create a 
modern, maintainable codebase with new features and improved user experience.

## Language & Stack

- **Developer / GitHub ID**: `Aishwaryahr16`
- **Backend**: Python 3.10+, Flask 3.0
- **Frontend**: Vanilla HTML5, plain CSS (no frameworks), Vanilla JavaScript (ES2022, strict mode)
- **Storage**: Browser localStorage for Top 10 leaderboard persistence
- **Testing**: Python `unittest` (built-in) + `pytest`

---

## Python Code Style

- Follow **PEP 8** strictly
- Add **type hints** to all function signatures
- Write **docstrings** for all functions (Google style)
- Use `copy.deepcopy()` for mutable board state
- Handle all exceptions explicitly — no bare `except` clauses
- Keep functions small and single-purpose (max ~30 lines)
- Use `snake_case` for variables and functions, `PascalCase` for classes
- Preserve original function names from the legacy code (`is_safe`, `generate_puzzle`, etc.)

## JavaScript Code Style

- Always use `'use strict';` at the top
- Use `const` by default, `let` only when reassignment needed, never `var`
- Use `camelCase` for variables and functions
- Use `async/await` with `try/catch` for all API calls
- Use **event delegation** for board interactions (one listener on the container)
- Always escape user HTML before rendering (XSS prevention)
- Never manipulate DOM directly inside event handlers — use dedicated render functions

## CSS Code Style

- Use **CSS custom properties** (`--variable`) for all colors, spacing, typography
- Support **dark mode** via `body.dark` class toggling CSS variables
- Group rules: layout → sizing → typography → color → borders → effects
- Keep media queries at the bottom, ordered largest to smallest breakpoint
- No inline styles in HTML — all styling in `styles.css`
- Use `kebab-case` for all class names and custom property names

---

## Architecture Principles

- **Separation of concerns**: Flask routes handle HTTP only; all Sudoku logic in `sudoku_logic.py`
- **Stateless frontend**: game state (board, timer, scores) lives on the client
- **Unique puzzles**: every generated puzzle must have exactly one solution (`count_solutions` capped at 2)
- **Locked cells**: prefilled cells AND hint-filled cells are immutable by the user
- **Event delegation**: use single parent-level listeners instead of per-cell listeners
- **Accessibility**: all interactive elements have `aria-label`, use semantic HTML5

---

## File Structure

```
github-copilot-python/
├── README.md                  ← Setup, test commands, GitHub ID (Aishwaryahr16)
├── instruction.md             ← Copilot instruction & architecture guide
├── prompts.json               ← Prompt templates for all milestones
├── Screenshots/               ← Milestone screenshots & initial tests console output
│   ├── initial_tests.png
│   ├── copilot_testing_framework.png
│   ├── copilot_unique_solution.png
│   ├── copilot_top10_localstorage.png
│   ├── copilot_3x3_colors.png
│   └── copilot_suggestion_rejected.png
├── starter/
│   ├── app.py                  ← Flask routes (thin HTTP layer only)
│   ├── sudoku_logic.py         ← All Sudoku game logic (pure Python)
│   ├── requirements.txt        ← Flask==3.0.3
│   ├── templates/
│   │   └── index.html          ← Single-page application
│   └── static/
│       ├── styles.css          ← Complete styling (dark/light, responsive)
│       └── game.js             ← Complete client-side game logic
└── tests/
    └── test_sudoku.py          ← Unit tests for sudoku_logic.py
```

---

## Feature Requirements (Rubric Reference)

### Core Game Logic (sudoku_logic.py)
- `generate_puzzle(clues)` must produce a puzzle with **one unique solvable solution**
- Difficulty: Easy (~46 clues), Medium (~35 clues), Hard (~27 clues)
- `is_safe()` must check row + column + 3×3 box constraints
- `get_conflicts()` must return all conflicting cell positions

### Interactive Features (game.js + app.py)
- Hint button: fills **one** valid empty cell and **locks** it (cyan color)
- Check button: highlights **all** incorrect entries via Flask `/check` route
- Immediate feedback: conflict detection on every keypress (before Check)
- Top 10 list: stored in `localStorage` with name, time, difficulty, hints
- Dark mode: toggled via `body.dark` class, persisted in `localStorage`
- Timer: starts on first user interaction, stops on puzzle completion

### Interface Requirements (styles.css + index.html)
- 3×3 Sudoku boxes **alternate in color** (no layout shifts)
- Bold borders separate the nine 3×3 boxes clearly
- Responsive layout: adapts to mobile and desktop without breaking
- Both light and dark modes keep all text and buttons visible
- Congratulatory message shows time + hints, asks for name for Top 10

---

## Testing Standards

- Use Python's built-in `unittest` module
- Test all functions in `sudoku_logic.py`
- Cover: happy path + edge cases + uniqueness verification
- Tests must be deterministic — use `copy.deepcopy()` to avoid shared state

**Test command:**
```bash
python3.14 -m unittest discover tests/ -v
```

---

## Copilot Usage Guidelines

- Use **Ask mode** for explaining logic and generating algorithm-heavy functions
- Use **Edit mode** for refactoring existing code to modern style
- Use **Agent mode** for multi-file changes
- **Always evaluate Copilot suggestions** before accepting — reject if:
  - Suggestion doesn't follow the conventions in this file
  - Code is hard to read or adds unnecessary complexity
  - Suggestion introduces external dependencies not in requirements.txt
- Document each major prompt-response pair with a screenshot in `Screenshots/`
