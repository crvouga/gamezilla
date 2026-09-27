@domain:chess @goal:chess-puzzles:6
Feature: Who may move, and when
  Only the side to move can move, and only legally. An illegal move is no move
  at all: the piece goes back and nothing is held against the player. Pieces
  cannot be moved while a wrong move is waiting for a retry, or once the
  puzzle is over.

  Background:
    Given Alice is signed in
    And Alice is solving the two-rook clearance puzzle

  Scenario: The opponent's pieces cannot be moved
    When Alice tries to move the opponent's piece g8-f8
    Then Alice is still asked to find the next move
    And Alice's board is unchanged

  Scenario: An illegal move goes back and is not held against the player
    When Alice tries the illegal move a1-a8
    Then Alice's board is unchanged
    And Alice is still asked to find the next move

  Scenario: Pieces cannot be moved after a wrong move until a retry
    When Alice plays a wrong move
    Then Alice cannot move pieces

  Scenario: Pieces cannot be moved once the puzzle is over
    When Alice solves the puzzle
    Then Alice cannot move pieces

  Scenario: Picking up a piece shows where it can go
    When Alice picks up the rook on a1
    Then Alice's board shows the rook on a1 can go to a2, a3, a4, a5, a6, b1, c1 and d1
