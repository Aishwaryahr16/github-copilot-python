from flask import Flask, render_template, jsonify, request
import sudoku_logic
import random

app = Flask(__name__)

# In-memory store for current puzzle and solution
CURRENT = {
    'puzzle': None,
    'solution': None
}

# Difficulty level clue counts (matching original repo structure)
DIFFICULTY_CLUES = {
    'easy':   46,
    'medium': 35,
    'hard':   27,
}


@app.route('/')
def index():
    """Serve the main game page."""
    return render_template('index.html')


@app.route('/new')
def new_game():
    """
    Generate a new Sudoku puzzle.
    Query params:
        difficulty: 'easy' | 'medium' | 'hard'  (default: 'medium')
        clues: int override for number of pre-filled cells
    """
    difficulty = request.args.get('difficulty', 'medium')
    clues = int(request.args.get('clues', DIFFICULTY_CLUES.get(difficulty, 35)))

    puzzle, solution = sudoku_logic.generate_puzzle(clues)
    CURRENT['puzzle'] = puzzle
    CURRENT['solution'] = solution

    return jsonify({
        'puzzle': puzzle,
        'solution': solution,
        'difficulty': difficulty
    })


@app.route('/check', methods=['POST'])
def check():
    """
    Check the current board for conflicts.
    Body JSON: { "board": [[...], ...] }
    """
    data = request.get_json() or {}
    board = data.get('board', [])

    if not board:
        return jsonify({'error': 'No board provided'}), 400

    conflicts = sudoku_logic.get_conflicts(board)
    return jsonify({'conflicts': conflicts})


@app.route('/hint', methods=['POST'])
def hint():
    """
    Provide a hint — reveal one correct empty cell.
    Body JSON: { "board": [[...], ...] }
    """
    data = request.get_json() or {}
    board = data.get('board', [])
    solution = CURRENT.get('solution')

    if not solution:
        return jsonify({'error': 'No active game'}), 400

    # Find empty cells
    empty_cells = [
        (r, c) for r in range(9) for c in range(9)
        if board[r][c] == 0
    ]

    if not empty_cells:
        return jsonify({'error': 'No empty cells'}), 400

    row, col = random.choice(empty_cells)
    value = solution[row][col]

    return jsonify({'row': row, 'col': col, 'value': value})


if __name__ == '__main__':
    app.run(debug=True)
