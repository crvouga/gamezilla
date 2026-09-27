@domain:chess
Feature: Puzzle import
  When the team imports puzzles, they want every invalid one rejected, so
  solvers only ever meet puzzles that can be solved. A puzzle is rejected if
  its line holds an illegal move, castles without the right to, finishes on
  the opponent's move, starts from a malformed position, or repeats a puzzle
  already in the pool.

  Scenario: A puzzle rejected at import is never served
    Given a puzzle file with two valid puzzles and five invalid ones has been imported
    And Alice is a guest
    And Alice is playing puzzles in their space
    When Alice plays through every puzzle the feed offers
    Then none of the rejected puzzles was served to Alice
