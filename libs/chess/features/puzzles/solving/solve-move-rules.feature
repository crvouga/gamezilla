@domain:chess @goal:chess-puzzles:5
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
    Then Alice is solving the puzzle
    And Alice's board is unchanged

  Scenario: An illegal move goes back and is not held against the player
    When Alice tries the illegal move a1-a8
    Then Alice is solving the puzzle
    And Alice's board is unchanged
    And the puzzle has no recorded outcome
    And the only thing recorded for the puzzle is that it started

  Scenario: Pieces cannot be moved after a wrong move until a retry
    When Alice plays a wrong move
    Then Alice cannot move pieces

  Scenario: Pieces cannot be moved once the puzzle is over
    When Alice plays a wrong move
    And Alice retries the puzzle
    And Alice plays a1-a5
    And Alice plays h1-h5
    Then Alice's puzzle is solved within 20 seconds
    And Alice cannot move pieces
