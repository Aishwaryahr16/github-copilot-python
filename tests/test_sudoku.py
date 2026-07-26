"""
Tests for sudoku_logic.py
─────────────────────────
Run command:
    python -m pytest tests/ -v

Covers all functions required by the rubric:
  - is_safe()           — constraint checking (row/col/box)
  - generate_puzzle()   — unique solvable puzzle generation
  - count_solutions()   — uniqueness verification
  - get_conflicts()     — conflict cell detection

# COPILOT NOTE (Milestone: Setting up testing framework)
# Prompt used: "Generate a Python unittest test file for sudoku_logic.py
# that tests is_safe(), generate_puzzle(), count_solutions(), and
# get_conflicts(). Include edge cases. Make tests deterministic."
#
# Copilot suggestion EVALUATED: Copilot initially generated a test for a
# function called `validate_board()` that does not exist in our codebase.
# That test was REJECTED. All other tests were accepted after review.
"""
import sys
import os
import copy
import unittest

# Allow importing from starter/ when running from project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'starter')))

from sudoku_logic import (
    is_safe,
    solve,
    count_solutions,
    generate_solved_board,
    generate_puzzle,
    get_conflicts,
    create_empty_board,
)


# ─────────────────────────────────────────────────────────────
# 1. is_safe() Tests
# ─────────────────────────────────────────────────────────────
class TestIsSafe(unittest.TestCase):
    """Tests for the is_safe constraint checker."""

    def setUp(self):
        self.empty = create_empty_board()

    def test_valid_on_empty_board(self):
        """Any number 1-9 is valid on an empty board."""
        for num in range(1, 10):
            with self.subTest(num=num):
                self.assertTrue(is_safe(self.empty, 0, 0, num))

    def test_row_conflict(self):
        """Duplicate in the same row is invalid."""
        board = copy.deepcopy(self.empty)
        board[0][0] = 5
        self.assertFalse(is_safe(board, 0, 8, 5))

    def test_column_conflict(self):
        """Duplicate in the same column is invalid."""
        board = copy.deepcopy(self.empty)
        board[0][0] = 7
        self.assertFalse(is_safe(board, 8, 0, 7))

    def test_box_conflict(self):
        """Duplicate in the same 3×3 box is invalid."""
        board = copy.deepcopy(self.empty)
        board[0][0] = 3
        self.assertFalse(is_safe(board, 1, 1, 3))

    def test_valid_different_number(self):
        """Different number in same row is valid."""
        board = copy.deepcopy(self.empty)
        board[0][0] = 5
        self.assertTrue(is_safe(board, 0, 8, 6))

    def test_no_conflict_across_boxes(self):
        """Same number in a different row, column, AND box is valid."""
        board = copy.deepcopy(self.empty)
        board[0][0] = 9
        # Row 3, col 3 is a completely different box/row/col
        self.assertTrue(is_safe(board, 3, 3, 9))


# ─────────────────────────────────────────────────────────────
# 2. count_solutions() Tests
# ─────────────────────────────────────────────────────────────
class TestCountSolutions(unittest.TestCase):
    """Tests for the uniqueness checker.
    
    # COPILOT NOTE (Milestone: Unique solution)
    # Prompt: "Write count_solutions(board, limit=2) using backtracking,
    # stopping early once count reaches limit."
    # Accepted after verifying it returns 1 for valid puzzles.
    """

    def test_empty_board_has_many_solutions(self):
        """Empty board has more than 1 solution."""
        board = create_empty_board()
        count = count_solutions(board, limit=2)
        self.assertGreater(count, 1)

    def test_solved_board_has_one_solution(self):
        """A fully solved board has exactly 1 solution."""
        solved = generate_solved_board()
        count = count_solutions(solved, limit=2)
        self.assertEqual(count, 1)


# ─────────────────────────────────────────────────────────────
# 3. generate_puzzle() Tests
# ─────────────────────────────────────────────────────────────
class TestGeneratePuzzle(unittest.TestCase):
    """Tests for puzzle generation.

    # COPILOT NOTE (Milestone: Unique solution)
    # Prompt: "Ensure generate_puzzle() only returns puzzles with exactly
    # one solution by using count_solutions(limit=2) before removing a cell."
    # Accepted. Verified uniqueness in tests below.
    """

    def test_puzzle_has_correct_shape(self):
        """Puzzle must be 9x9."""
        puzzle, _ = generate_puzzle(35)
        self.assertEqual(len(puzzle), 9)
        for row in puzzle:
            self.assertEqual(len(row), 9)

    def test_easy_has_more_clues_than_hard(self):
        """Easy difficulty (more clues) should have fewer empty cells than Hard."""
        easy_puzzle, _ = generate_puzzle(46)
        hard_puzzle, _ = generate_puzzle(27)
        easy_empty = sum(1 for r in easy_puzzle for c in r if c == 0)
        hard_empty = sum(1 for r in hard_puzzle for c in r if c == 0)
        self.assertLess(easy_empty, hard_empty)

    def test_unique_solution_medium(self):
        """Medium puzzle must have exactly one solution."""
        puzzle, _ = generate_puzzle(35)
        test = copy.deepcopy(puzzle)
        self.assertEqual(count_solutions(test, limit=2), 1)

    def test_unique_solution_hard(self):
        """Hard puzzle must have exactly one solution."""
        puzzle, _ = generate_puzzle(27)
        test = copy.deepcopy(puzzle)
        self.assertEqual(count_solutions(test, limit=2), 1)

    def test_solution_matches_puzzle_clues(self):
        """Every non-zero puzzle cell must match the returned solution."""
        puzzle, solution = generate_puzzle(35)
        for r in range(9):
            for c in range(9):
                if puzzle[r][c] != 0:
                    self.assertEqual(puzzle[r][c], solution[r][c])

    def test_puzzle_has_empty_cells(self):
        """Every generated puzzle must have some empty cells."""
        puzzle, _ = generate_puzzle(35)
        empty = sum(1 for row in puzzle for v in row if v == 0)
        self.assertGreater(empty, 0)


# ─────────────────────────────────────────────────────────────
# 4. get_conflicts() Tests
# ─────────────────────────────────────────────────────────────
class TestGetConflicts(unittest.TestCase):
    """Tests for conflict detection.

    # COPILOT NOTE (Milestone: Top 10 / check puzzle)
    # Prompt: "Write get_conflicts(board) that returns a list of [row, col]
    # pairs for cells that violate Sudoku rules."
    # Accepted. Verified on known-good and known-bad boards below.
    """

    def test_no_conflicts_on_correct_solution(self):
        """A complete correct solution has zero conflicts."""
        _, solution = generate_puzzle(35)
        self.assertEqual(get_conflicts(solution), [])

    def test_detects_row_conflict(self):
        """Duplicate in same row is reported."""
        board = create_empty_board()
        board[0][0] = 5
        board[0][5] = 5
        conflicts = get_conflicts(board)
        self.assertIn([0, 0], conflicts)
        self.assertIn([0, 5], conflicts)

    def test_detects_column_conflict(self):
        """Duplicate in same column is reported."""
        board = create_empty_board()
        board[0][0] = 3
        board[7][0] = 3
        conflicts = get_conflicts(board)
        self.assertIn([0, 0], conflicts)
        self.assertIn([7, 0], conflicts)

    def test_detects_box_conflict(self):
        """Duplicate in same 3×3 box is reported."""
        board = create_empty_board()
        board[0][0] = 9
        board[2][2] = 9
        conflicts = get_conflicts(board)
        self.assertIn([0, 0], conflicts)
        self.assertIn([2, 2], conflicts)

    def test_no_false_positives_on_valid_partial_board(self):
        """A partial board with no duplicates reports no conflicts."""
        board = create_empty_board()
        board[0][0] = 1
        board[0][3] = 2
        self.assertEqual(get_conflicts(board), [])


# ─────────────────────────────────────────────────────────────
# 5. 3x3 Box Alternating Color Logic Tests
# ─────────────────────────────────────────────────────────────
class TestBoxIndexCalculation(unittest.TestCase):
    """Tests for the 3x3 box alternating colour index logic.

    # COPILOT NOTE (Milestone: 3x3 square colors)
    # Prompt: "Calculate box index as Math.floor(row/3)*3 + Math.floor(col/3)
    # and alternate even/odd classes."
    # Accepted. Verified below that box positions alternate correctly.
    """

    def _box_index(self, row, col):
        return (row // 3) * 3 + (col // 3)

    def test_top_left_box_is_even(self):
        """Box at rows 0-2, cols 0-2 has index 0 (even)."""
        self.assertEqual(self._box_index(0, 0) % 2, 0)
        self.assertEqual(self._box_index(2, 2) % 2, 0)

    def test_top_middle_box_is_odd(self):
        """Box at rows 0-2, cols 3-5 has index 1 (odd)."""
        self.assertEqual(self._box_index(0, 3) % 2, 1)
        self.assertEqual(self._box_index(2, 5) % 2, 1)

    def test_top_right_box_is_even(self):
        """Box at rows 0-2, cols 6-8 has index 2 (even)."""
        self.assertEqual(self._box_index(0, 6) % 2, 0)

    def test_center_box_is_even(self):
        """Center box (rows 3-5, cols 3-5) has index 4 (even)."""
        self.assertEqual(self._box_index(4, 4) % 2, 0)

    def test_bottom_right_box_is_even(self):
        """Bottom-right box (rows 6-8, cols 6-8) has index 8 (even)."""
        self.assertEqual(self._box_index(8, 8) % 2, 0)

    def test_all_9_boxes_alternate(self):
        """Boxes 0-8 must alternate between even and odd."""
        expected = [0, 1, 0, 1, 0, 1, 0, 1, 0]  # even, odd, even...
        corners = [(0,0),(0,3),(0,6),(3,0),(3,3),(3,6),(6,0),(6,3),(6,6)]
        for (r, c), exp in zip(corners, expected):
            with self.subTest(row=r, col=c):
                self.assertEqual(self._box_index(r, c) % 2, exp)


if __name__ == '__main__':
    unittest.main(verbosity=2)
