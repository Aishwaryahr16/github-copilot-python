'use strict';

/**
 * game.js — Sudoku Game Client Logic
 * ────────────────────────────────────
 * Implements all features from the Udacity GitHub Copilot project:
 *  - Sudoku board rendering with alternating 3x3 box colors
 *  - Difficulty selector (easy, medium, hard)
 *  - Timer that starts on first user interaction
 *  - Check Puzzle button (event delegation)
 *  - Hint button with unique colors
 *  - Immediate feedback on invalid entries
 *  - Top 10 scores in localStorage (name, time, difficulty, hints)
 *  - Congratulatory message on completion
 *  - Dark/Light mode toggle
 *  - Responsive design with mobile number pad
 */

// ── API Endpoints (matching Flask routes) ────────────────────
const API_NEW   = '/new';
const API_CHECK = '/check';
const API_HINT  = '/hint';

// ── Game State ────────────────────────────────────────────────
let puzzle     = [];   // Original puzzle (0 = empty)
let solution   = [];   // Full solution
let board      = [];   // Current mutable board
let difficulty = 'medium';
let hintsUsed  = 0;

let selectedRow = -1;
let selectedCol = -1;
let isComplete  = false;

let timerSecs     = 0;
let timerInterval = null;
let timerStarted  = false;

let lockedCells   = new Set();  // "r,c" — pre-filled + hint cells
let hintCells     = new Set();  // "r,c" — filled by hint button
let conflictCells = new Set();  // "r,c" — highlighted by check/realtime

// ── DOM Elements ──────────────────────────────────────────────
const boardEl       = document.getElementById('sudoku-board');
const timerEl       = document.getElementById('timer');
const hintsUsedEl   = document.getElementById('hints-used');
const difficultyEl  = document.getElementById('difficulty');
const loadingEl     = document.getElementById('loading-overlay');
const modalEl       = document.getElementById('congrats-modal');
const lbBodyEl      = document.getElementById('leaderboard-body');

// ── Initialise ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDarkMode();
  bindEvents();
  renderLeaderboard();
  loadNewGame();
});

// ── Dark Mode ─────────────────────────────────────────────────
function loadDarkMode() {
  if (localStorage.getItem('sudoku-theme') === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('dark-mode-btn').textContent = '☀️';
  }
}

function toggleDarkMode() {
  const dark = document.body.classList.toggle('dark');
  document.getElementById('dark-mode-btn').textContent = dark ? '☀️' : '🌙';
  localStorage.setItem('sudoku-theme', dark ? 'dark' : 'light');
}

// ── Event Binding ─────────────────────────────────────────────
function bindEvents() {
  document.getElementById('dark-mode-btn').addEventListener('click', toggleDarkMode);
  document.getElementById('new-game').addEventListener('click', loadNewGame);
  document.getElementById('check-btn').addEventListener('click', checkPuzzle);
  document.getElementById('hint-btn').addEventListener('click', getHint);

  // Board uses event delegation — one listener for all cells
  boardEl.addEventListener('click', onBoardClick);

  // Keyboard input
  document.addEventListener('keydown', onKeyDown);

  // Mobile number pad
  document.getElementById('number-pad').addEventListener('click', onNumPad);

  // Modal buttons
  document.getElementById('save-btn').addEventListener('click', saveScore);
  document.getElementById('play-again-btn').addEventListener('click', () => {
    closeModal();
    loadNewGame();
  });
  document.getElementById('player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveScore();
  });
}

// ── Load New Game ─────────────────────────────────────────────
async function loadNewGame() {
  difficulty = difficultyEl.value;
  showLoading(true);
  stopTimer();
  resetTimer();

  try {
    const res  = await fetch(`${API_NEW}?difficulty=${difficulty}`);
    const data = await res.json();

    puzzle     = data.puzzle;
    solution   = data.solution;
    board      = puzzle.map(row => [...row]);
    hintsUsed  = 0;
    isComplete = false;
    timerStarted = false;
    selectedRow  = -1;
    selectedCol  = -1;
    lockedCells  = new Set();
    hintCells    = new Set();
    conflictCells= new Set();

    // Lock all pre-filled cells
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r][c] !== 0) lockedCells.add(`${r},${c}`);
      }
    }

    updateHintsDisplay();
    renderBoard();
  } catch (err) {
    console.error('Failed to load new game:', err);
    alert('Error generating puzzle. Please try again.');
  } finally {
    showLoading(false);
  }
}

// ── Board Rendering ───────────────────────────────────────────
function renderBoard() {
  boardEl.innerHTML = '';

  const selVal = (selectedRow >= 0)
    ? board[selectedRow][selectedCol]
    : null;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('div');
      const key  = `${r},${c}`;
      const val  = board[r][c];
      const boxIdx = Math.floor(r / 3) * 3 + Math.floor(c / 3);

      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Alternating 3x3 box background colour
      cell.classList.add(boxIdx % 2 === 0 ? 'box-even' : 'box-odd');

      // Bold borders at box boundaries
      if (r % 3 === 0 && r !== 0) cell.classList.add('box-top');
      if (c % 3 === 0 && c !== 0) cell.classList.add('box-left');

      // Cell type
      if (lockedCells.has(key) && !hintCells.has(key)) cell.classList.add('locked');
      if (hintCells.has(key))                          cell.classList.add('hint');
      if (!lockedCells.has(key) && val !== 0)          cell.classList.add('user');

      // State overlays (conflict > selected > same-number)
      if (conflictCells.has(key))    cell.classList.add('conflict');
      if (r === selectedRow && c === selectedCol) cell.classList.add('selected');
      if (selVal && selVal !== 0 && selVal === val) cell.classList.add('same-num');

      if (val !== 0) cell.textContent = val;

      boardEl.appendChild(cell);
    }
  }
}

// ── Board Click (Event Delegation) ───────────────────────────
function onBoardClick(e) {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  selectedRow = parseInt(cell.dataset.row, 10);
  selectedCol = parseInt(cell.dataset.col, 10);
  renderBoard();
}

// ── Keyboard Input ────────────────────────────────────────────
function onKeyDown(e) {
  if (isComplete) return;

  // Arrow-key navigation
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
    e.preventDefault();
    if (selectedRow < 0) { selectedRow = 0; selectedCol = 0; }
    else {
      if (e.key === 'ArrowUp')    selectedRow = Math.max(0, selectedRow - 1);
      if (e.key === 'ArrowDown')  selectedRow = Math.min(8, selectedRow + 1);
      if (e.key === 'ArrowLeft')  selectedCol = Math.max(0, selectedCol - 1);
      if (e.key === 'ArrowRight') selectedCol = Math.min(8, selectedCol + 1);
    }
    renderBoard();
    return;
  }

  if (selectedRow < 0) return;

  // Number entry
  if (e.key >= '1' && e.key <= '9') {
    enterNumber(parseInt(e.key, 10));
  }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    enterNumber(0);
  }
}

// ── Mobile Number Pad (Event Delegation) ─────────────────────
function onNumPad(e) {
  const btn = e.target.closest('.num-key');
  if (!btn) return;
  enterNumber(parseInt(btn.dataset.num, 10));
}

// ── Enter a Number into the Board ────────────────────────────
function enterNumber(num) {
  if (selectedRow < 0 || isComplete) return;

  const key = `${selectedRow},${selectedCol}`;
  if (lockedCells.has(key)) return;  // Cannot edit locked/hint cells

  // Start timer on first user input
  if (!timerStarted) { startTimer(); timerStarted = true; }

  board[selectedRow][selectedCol] = num;
  conflictCells.delete(key);

  if (num !== 0) {
    // Immediate feedback: real-time conflict detection
    detectConflicts(selectedRow, selectedCol, num);
  }

  renderBoard();
  if (num !== 0) checkCompletion();
}

// ── Real-time Conflict Detection ──────────────────────────────
function detectConflicts(r, c, num) {
  // Check row
  for (let col = 0; col < 9; col++) {
    if (col !== c && board[r][col] === num) {
      conflictCells.add(`${r},${col}`);
      conflictCells.add(`${r},${c}`);
    }
  }
  // Check column
  for (let row = 0; row < 9; row++) {
    if (row !== r && board[row][c] === num) {
      conflictCells.add(`${row},${c}`);
      conflictCells.add(`${r},${c}`);
    }
  }
  // Check 3x3 box
  const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
  for (let i = br; i < br + 3; i++) {
    for (let j = bc; j < bc + 3; j++) {
      if ((i !== r || j !== c) && board[i][j] === num) {
        conflictCells.add(`${i},${j}`);
        conflictCells.add(`${r},${c}`);
      }
    }
  }
}

// ── Check Puzzle (via Flask API) ──────────────────────────────
async function checkPuzzle() {
  try {
    const res  = await fetch(API_CHECK, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ board }),
    });
    const data = await res.json();

    conflictCells = new Set(data.conflicts.map(([r, c]) => `${r},${c}`));
    renderBoard();

    if (data.conflicts.length === 0) {
      const full = board.every(row => row.every(v => v !== 0));
      if (full) handleCompletion();
    }
  } catch (err) {
    console.error('Check failed:', err);
  }
}

// ── Hint (via Flask API) ──────────────────────────────────────
async function getHint() {
  if (isComplete) return;
  try {
    const res  = await fetch(API_HINT, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ board }),
    });
    const data = await res.json();

    if (data.error) { console.warn('Hint:', data.error); return; }

    const { row, col, value } = data;
    const key = `${row},${col}`;

    board[row][col] = value;
    lockedCells.add(key);
    hintCells.add(key);
    conflictCells.delete(key);
    hintsUsed++;

    if (!timerStarted) { startTimer(); timerStarted = true; }

    updateHintsDisplay();
    renderBoard();
    checkCompletion();
  } catch (err) {
    console.error('Hint failed:', err);
  }
}

// ── Completion Check ──────────────────────────────────────────
function checkCompletion() {
  if (!board.every(row => row.every(v => v !== 0))) return;
  if (!board.every((row, r) => row.every((v, c) => v === solution[r][c]))) return;
  handleCompletion();
}

function handleCompletion() {
  if (isComplete) return;
  isComplete = true;
  stopTimer();
  setTimeout(showCongratsModal, 400);
}

// ── Timer ─────────────────────────────────────────────────────
function startTimer() {
  timerInterval = setInterval(() => { timerSecs++; updateTimerDisplay(); }, 1000);
}
function stopTimer()  { clearInterval(timerInterval); timerInterval = null; }
function resetTimer() { timerSecs = 0; timerStarted = false; updateTimerDisplay(); }
function updateTimerDisplay() { timerEl.textContent = formatTime(timerSecs); }
function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

function updateHintsDisplay() { hintsUsedEl.textContent = hintsUsed; }

// ── Loading ───────────────────────────────────────────────────
function showLoading(show) { loadingEl.classList.toggle('hidden', !show); }

// ── Congratulations Modal ─────────────────────────────────────
function showCongratsModal() {
  document.getElementById('modal-time').textContent       = formatTime(timerSecs);
  document.getElementById('modal-difficulty').textContent = cap(difficulty);
  document.getElementById('modal-hints').textContent      = hintsUsed;
  document.getElementById('player-name').value            = '';
  modalEl.classList.remove('hidden');
  document.getElementById('player-name').focus();
}
function closeModal() { modalEl.classList.add('hidden'); }

// ── Save Score to Leaderboard ─────────────────────────────────
function saveScore() {
  const name = document.getElementById('player-name').value.trim() || 'Anonymous';
  const entry = { name, time: timerSecs, timeStr: formatTime(timerSecs), difficulty, hints: hintsUsed };

  let lb = getLeaderboard();
  lb.push(entry);
  lb.sort((a, b) => a.time - b.time);
  lb = lb.slice(0, 10);
  localStorage.setItem('sudoku-top10', JSON.stringify(lb));

  renderLeaderboard();
  closeModal();
}

// ── Leaderboard ───────────────────────────────────────────────
function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem('sudoku-top10')) || []; }
  catch { return []; }
}

function renderLeaderboard() {
  const lb = getLeaderboard();
  if (!lb.length) {
    lbBodyEl.innerHTML = '<tr><td colspan="5" class="no-scores">No scores yet — complete a game to appear here!</td></tr>';
    return;
  }
  lbBodyEl.innerHTML = lb.map((e, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
    const cls   = i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : '';
    return `<tr class="${cls}">
      <td>${medal}</td>
      <td>${safe(e.name)}</td>
      <td style="font-family:var(--font-mono);font-weight:600">${e.timeStr}</td>
      <td><span class="badge badge-${e.difficulty}">${e.difficulty}</span></td>
      <td>${e.hints}</td>
    </tr>`;
  }).join('');
}

// ── Utility ───────────────────────────────────────────────────
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/** Escape HTML to prevent XSS from user-entered names. */
function safe(s) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}
