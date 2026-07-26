/**
 * Sudoku Game — game.js
 * ─────────────────────
 * Complete client-side game logic:
 *   - Fetches puzzles from the Flask API
 *   - Renders the 9×9 board with full state management
 *   - Handles keyboard + click + mobile number-pad input
 *   - Real-time conflict detection
 *   - Timer (starts on first interaction, stops on completion)
 *   - Hint & Check functionality via API calls
 *   - Dark / Light mode with localStorage persistence
 *   - Top-10 leaderboard stored in localStorage
 */

'use strict';

// ─────────────────────────────────────────────────────────────
// API Endpoints
// ─────────────────────────────────────────────────────────────
const API = {
  newGame : '/api/new-game',
  check   : '/api/check',
  hint    : '/api/hint',
};

// ─────────────────────────────────────────────────────────────
// Game State
// ─────────────────────────────────────────────────────────────
let state = {
  puzzle      : [],          // Original puzzle (0 = empty, read-only reference)
  solution    : [],          // Full correct solution
  board       : [],          // Current mutable board
  difficulty  : 'medium',
  hintsUsed   : 0,
  timerSeconds: 0,
  timerInterval: null,
  timerStarted: false,
  selectedCell: null,        // { row, col }
  isComplete  : false,
  lockedCells : new Set(),   // "r,c" — pre-filled + hint cells (immutable)
  conflictCells: new Set(),  // "r,c" — highlighted by Check or real-time
  hintCells   : new Set(),   // "r,c" — cells filled via Hint button
};

// ─────────────────────────────────────────────────────────────
// DOM References
// ─────────────────────────────────────────────────────────────
const boardEl        = document.getElementById('sudoku-board');
const timerEl        = document.getElementById('timer');
const hintCountEl    = document.getElementById('hint-count');
const difficultyEl   = document.getElementById('difficulty');
const loadingOverlay = document.getElementById('loading-overlay');
const completionModal= document.getElementById('completion-modal');
const leaderboardBody= document.getElementById('leaderboard-body');

// ─────────────────────────────────────────────────────────────
// Init on DOM Ready
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  setupEventListeners();
  renderLeaderboard();
  startNewGame();
});

// ─────────────────────────────────────────────────────────────
// Dark Mode
// ─────────────────────────────────────────────────────────────
function initDarkMode() {
  const saved = localStorage.getItem('sudoku-theme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('dark-mode-toggle').textContent = '☀️';
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark');
  document.getElementById('dark-mode-toggle').textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('sudoku-theme', isDark ? 'dark' : 'light');
}

// ─────────────────────────────────────────────────────────────
// Event Listeners
// ─────────────────────────────────────────────────────────────
function setupEventListeners() {
  document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
  document.getElementById('btn-new-game').addEventListener('click', startNewGame);
  document.getElementById('btn-check').addEventListener('click', checkPuzzle);
  document.getElementById('btn-hint').addEventListener('click', getHint);
  document.getElementById('save-score-btn').addEventListener('click', saveScore);
  document.getElementById('modal-new-game-btn').addEventListener('click', () => {
    closeModal();
    startNewGame();
  });

  // Keyboard navigation & input
  document.addEventListener('keydown', handleKeyDown);

  // Mobile number pad
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const num = parseInt(btn.dataset.num, 10);
      handleNumberInput(num);
    });
  });

  // Allow pressing Enter in the player name field to save score
  document.getElementById('player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveScore();
  });
}

// ─────────────────────────────────────────────────────────────
// New Game
// ─────────────────────────────────────────────────────────────
async function startNewGame() {
  state.difficulty = difficultyEl.value;
  showLoading(true);
  stopTimer();
  resetTimer();

  try {
    const res  = await fetch(API.newGame, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ difficulty: state.difficulty }),
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'Unknown error');

    // Reset state
    state.puzzle       = data.puzzle;
    state.solution     = data.solution;
    state.board        = data.puzzle.map(row => [...row]);
    state.hintsUsed    = 0;
    state.selectedCell = null;
    state.isComplete   = false;
    state.timerStarted = false;
    state.lockedCells  = new Set();
    state.conflictCells= new Set();
    state.hintCells    = new Set();

    // Lock all pre-filled cells
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (state.puzzle[r][c] !== 0) state.lockedCells.add(`${r},${c}`);
      }
    }

    updateHintCount();
    renderBoard();

  } catch (err) {
    console.error('Failed to start new game:', err);
    alert('Could not generate puzzle. Please refresh and try again.');
  } finally {
    showLoading(false);
  }
}

// ─────────────────────────────────────────────────────────────
// Board Rendering
// ─────────────────────────────────────────────────────────────
function renderBoard() {
  boardEl.innerHTML = '';

  const selVal = state.selectedCell
    ? state.board[state.selectedCell.row][state.selectedCell.col]
    : null;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell     = document.createElement('div');
      const key      = `${row},${col}`;
      const value    = state.board[row][col];
      const isLocked = state.lockedCells.has(key);
      const isHint   = state.hintCells.has(key);
      const boxIdx   = Math.floor(row / 3) * 3 + Math.floor(col / 3);

      // Base class + role
      cell.className = 'cell';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}${value ? ', value ' + value : ', empty'}`);
      cell.dataset.row = row;
      cell.dataset.col = col;

      // Alternating box background
      cell.classList.add(boxIdx % 2 === 0 ? 'box-even' : 'box-odd');

      // Bold borders at 3×3 box boundaries
      if (row % 3 === 0 && row !== 0) cell.classList.add('border-top-bold');
      if (col % 3 === 0 && col !== 0) cell.classList.add('border-left-bold');

      // Cell type classes
      if (isLocked && !isHint) cell.classList.add('locked');
      if (isHint)               cell.classList.add('hint-cell');
      if (!isLocked && !isHint && value !== 0) cell.classList.add('user-input');

      // Conflict highlight
      if (state.conflictCells.has(key)) cell.classList.add('conflict');

      // Selected cell
      if (state.selectedCell && state.selectedCell.row === row && state.selectedCell.col === col) {
        cell.classList.add('selected');
      }

      // Highlight same number
      if (selVal && selVal !== 0 && selVal === value) {
        cell.classList.add('same-number');
      }

      // Value display
      if (value !== 0) cell.textContent = value;

      // Click to select
      cell.addEventListener('click', () => selectCell(row, col));

      boardEl.appendChild(cell);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Cell Selection
// ─────────────────────────────────────────────────────────────
function selectCell(row, col) {
  state.selectedCell = { row, col };
  renderBoard();
}

// ─────────────────────────────────────────────────────────────
// Keyboard Handling
// ─────────────────────────────────────────────────────────────
function handleKeyDown(e) {
  if (!state.selectedCell || state.isComplete) return;

  const { row, col } = state.selectedCell;

  // Arrow-key navigation
  const moves = {
    ArrowUp   : [-1,  0],
    ArrowDown : [ 1,  0],
    ArrowLeft : [ 0, -1],
    ArrowRight: [ 0,  1],
  };
  if (moves[e.key]) {
    const [dr, dc] = moves[e.key];
    selectCell(Math.max(0, Math.min(8, row + dr)), Math.max(0, Math.min(8, col + dc)));
    e.preventDefault();
    return;
  }

  // Number input (1–9)
  if (e.key >= '1' && e.key <= '9') {
    handleNumberInput(parseInt(e.key, 10));
    return;
  }

  // Clear cell
  if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') {
    handleNumberInput(0);
  }
}

function handleNumberInput(num) {
  if (!state.selectedCell || state.isComplete) return;

  const { row, col } = state.selectedCell;
  const key = `${row},${col}`;

  // Cannot modify locked (pre-filled or hint) cells
  if (state.lockedCells.has(key)) return;

  // Start timer on first user interaction
  if (!state.timerStarted) {
    startTimer();
    state.timerStarted = true;
  }

  if (num === 0) {
    // Clear cell
    state.board[row][col] = 0;
    state.conflictCells.delete(key);
  } else {
    // Place number
    state.board[row][col] = num;
    detectConflictsAt(row, col, num);
  }

  renderBoard();
  if (num !== 0) checkCompletion();
}

// ─────────────────────────────────────────────────────────────
// Real-time Conflict Detection
// ─────────────────────────────────────────────────────────────
function detectConflictsAt(row, col, num) {
  // Clear previous conflicts from this position first
  state.conflictCells.delete(`${row},${col}`);

  const addConflict = (r, c) => {
    state.conflictCells.add(`${r},${c}`);
    state.conflictCells.add(`${row},${col}`);
  };

  // Row conflicts
  for (let c = 0; c < 9; c++) {
    if (c !== col && state.board[row][c] === num) addConflict(row, c);
  }

  // Column conflicts
  for (let r = 0; r < 9; r++) {
    if (r !== row && state.board[r][col] === num) addConflict(r, col);
  }

  // 3×3 box conflicts
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if ((r !== row || c !== col) && state.board[r][c] === num) addConflict(r, c);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Check Puzzle (via API)
// ─────────────────────────────────────────────────────────────
async function checkPuzzle() {
  try {
    const res  = await fetch(API.check, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ board: state.board }),
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    state.conflictCells = new Set(data.conflicts.map(([r, c]) => `${r},${c}`));
    renderBoard();

    // If no conflicts and board is full → completion
    if (data.conflicts.length === 0) {
      const isFull = state.board.every(row => row.every(cell => cell !== 0));
      if (isFull) handleCompletion();
    }

  } catch (err) {
    console.error('Check failed:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Hint (via API)
// ─────────────────────────────────────────────────────────────
async function getHint() {
  if (state.isComplete) return;

  try {
    const res  = await fetch(API.hint, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ board: state.board, solution: state.solution }),
    });
    const data = await res.json();

    if (!data.success) {
      console.warn('Hint not available:', data.error);
      return;
    }

    const { row, col, value } = data;
    const key = `${row},${col}`;

    state.board[row][col] = value;
    state.lockedCells.add(key);   // Lock the hint cell
    state.hintCells.add(key);     // Mark as hint-colored
    state.conflictCells.delete(key);
    state.hintsUsed++;

    // Start timer if not already running
    if (!state.timerStarted) {
      startTimer();
      state.timerStarted = true;
    }

    updateHintCount();
    renderBoard();
    checkCompletion();

  } catch (err) {
    console.error('Hint failed:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Completion Detection
// ─────────────────────────────────────────────────────────────
function checkCompletion() {
  // Board must be fully filled
  const isFull = state.board.every(row => row.every(cell => cell !== 0));
  if (!isFull) return;

  // Every cell must match the solution
  const isCorrect = state.board.every((row, r) =>
    row.every((cell, c) => cell === state.solution[r][c])
  );

  if (isCorrect) handleCompletion();
}

function handleCompletion() {
  if (state.isComplete) return;
  state.isComplete = true;
  stopTimer();

  // Animate board cells
  animateBoardCompletion();

  // Show modal after animation
  setTimeout(showCompletionModal, 600);
}

function animateBoardCompletion() {
  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, i) => {
    setTimeout(() => cell.classList.add('complete-animate'), i * 8);
  });
}

// ─────────────────────────────────────────────────────────────
// Timer
// ─────────────────────────────────────────────────────────────
function startTimer() {
  state.timerInterval = setInterval(() => {
    state.timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function resetTimer() {
  state.timerSeconds = 0;
  state.timerStarted = false;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  timerEl.textContent = formatTime(state.timerSeconds);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// Hint Count Display
// ─────────────────────────────────────────────────────────────
function updateHintCount() {
  hintCountEl.textContent = state.hintsUsed;
}

// ─────────────────────────────────────────────────────────────
// Loading Overlay
// ─────────────────────────────────────────────────────────────
function showLoading(visible) {
  loadingOverlay.classList.toggle('hidden', !visible);
}

// ─────────────────────────────────────────────────────────────
// Completion Modal
// ─────────────────────────────────────────────────────────────
function showCompletionModal() {
  document.getElementById('completion-time').textContent       = formatTime(state.timerSeconds);
  document.getElementById('completion-difficulty').textContent = capitalise(state.difficulty);
  document.getElementById('completion-hints').textContent      = state.hintsUsed;
  document.getElementById('player-name').value                 = '';
  completionModal.classList.remove('hidden');
  document.getElementById('player-name').focus();
}

function closeModal() {
  completionModal.classList.add('hidden');
}

// ─────────────────────────────────────────────────────────────
// Score Saving
// ─────────────────────────────────────────────────────────────
function saveScore() {
  const name = document.getElementById('player-name').value.trim() || 'Anonymous';
  addToLeaderboard({
    name,
    time         : state.timerSeconds,
    timeFormatted: formatTime(state.timerSeconds),
    difficulty   : state.difficulty,
    hints        : state.hintsUsed,
    date         : new Date().toLocaleDateString(),
  });
  closeModal();
}

// ─────────────────────────────────────────────────────────────
// Leaderboard — localStorage
// ─────────────────────────────────────────────────────────────
const LEADERBOARD_KEY = 'sudoku-leaderboard-v1';

function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];
  } catch {
    return [];
  }
}

function addToLeaderboard(entry) {
  let lb = getLeaderboard();
  lb.push(entry);
  lb.sort((a, b) => a.time - b.time);   // Sort fastest first
  lb = lb.slice(0, 10);                  // Keep top 10
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(lb));
  renderLeaderboard();
}

function renderLeaderboard() {
  const lb = getLeaderboard();

  if (lb.length === 0) {
    leaderboardBody.innerHTML =
      '<tr><td colspan="5" class="no-scores">No scores yet — complete a game to appear here!</td></tr>';
    return;
  }

  leaderboardBody.innerHTML = lb.map((entry, idx) => {
    const rankClass = idx === 0 ? 'rank-gold' : idx === 1 ? 'rank-silver' : idx === 2 ? 'rank-bronze' : '';
    const rankIcon  = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
    return `
      <tr class="${rankClass}">
        <td>${rankIcon}</td>
        <td>${escapeHtml(entry.name)}</td>
        <td><span style="font-family:var(--font-mono);font-weight:600">${entry.timeFormatted}</span></td>
        <td><span class="difficulty-badge difficulty-${entry.difficulty}">${entry.difficulty}</span></td>
        <td>${entry.hints}</td>
      </tr>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
// Utility Helpers
// ─────────────────────────────────────────────────────────────

/** Escape HTML to prevent XSS when rendering user-entered names. */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/** Capitalise first letter of a string. */
function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
