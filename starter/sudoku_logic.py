import copy
import random

SIZE = 9
EMPTY = 0


def deep_copy(board):
    """Return a deep copy of the board."""
    return copy.deepcopy(board)


def create_empty_board():
    """Return an empty 9x9 board filled with zeros."""
    return [[EMPTY for _ in range(SIZE)] for _ in range(SIZE)]


def is_safe(board, row, col, num):
    """Check if placing num at (row, col) is valid."""
    # Check row and column
    for x in range(SIZE):
        if board[row][x] == num or board[x][col] == num:
            return False
    # Check 3x3 box
    start_row = row - row % 3
    start_col = col - col % 3
    for i in range(3):
        for j in range(3):
            if board[start_row + i][start_col + j] == num:
                return False
    return True


def solve(board):
    """Solve the board using backtracking. Returns True if solved."""
    for row in range(SIZE):
        for col in range(SIZE):
            if board[row][col] == EMPTY:
                numbers = list(range(1, 10))
                random.shuffle(numbers)
                for num in numbers:
                    if is_safe(board, row, col, num):
                        board[row][col] = num
                        if solve(board):
                            return True
                        board[row][col] = EMPTY
                return False
    return True


def count_solutions(board, limit=2):
    """
    Count the number of solutions up to limit.
    Ensures puzzle has a unique solution.
    """
    count = [0]

    def backtrack():
        if count[0] >= limit:
            return
        for row in range(SIZE):
            for col in range(SIZE):
                if board[row][col] == EMPTY:
                    for num in range(1, 10):
                        if is_safe(board, row, col, num):
                            board[row][col] = num
                            backtrack()
                            board[row][col] = EMPTY
                            if count[0] >= limit:
                                return
                    return
        count[0] += 1

    backtrack()
    return count[0]


def generate_solved_board():
    """Generate a complete, randomly filled valid Sudoku board."""
    board = create_empty_board()
    # Fill diagonal 3x3 boxes first (they are independent)
    for box in range(0, SIZE, 3):
        nums = list(range(1, 10))
        random.shuffle(nums)
        for i in range(3):
            for j in range(3):
                board[box + i][box + j] = nums[i * 3 + j]
    solve(board)
    return board


def generate_puzzle(clues=35):
    """
    Generate a Sudoku puzzle with a given number of clues.
    Ensures the puzzle has exactly one unique solution.

    Args:
        clues: Number of pre-filled cells (default 35 = medium difficulty)
               Easy ~46, Medium ~35, Hard ~27

    Returns:
        tuple: (puzzle, solution) — both 9x9 lists
    """
    solution = generate_solved_board()
    puzzle = deep_copy(solution)

    cells_to_remove = SIZE * SIZE - clues
    cells = [(r, c) for r in range(SIZE) for c in range(SIZE)]
    random.shuffle(cells)

    removed = 0
    for row, col in cells:
        if removed >= cells_to_remove:
            break
        backup = puzzle[row][col]
        puzzle[row][col] = EMPTY
        # Only keep removal if puzzle still has unique solution
        test = deep_copy(puzzle)
        if count_solutions(test, limit=2) != 1:
            puzzle[row][col] = backup
        else:
            removed += 1

    return puzzle, solution


def get_conflicts(board):
    """
    Return a list of [row, col] pairs that contain conflicting values.

    Args:
        board: 9x9 grid (0 = empty)

    Returns:
        List of [row, col] positions with conflicts
    """
    conflicts = []
    for row in range(SIZE):
        for col in range(SIZE):
            if board[row][col] != EMPTY:
                val = board[row][col]
                board[row][col] = EMPTY  # Temporarily clear
                if not is_safe(board, row, col, val):
                    conflicts.append([row, col])
                board[row][col] = val  # Restore
    return conflicts
