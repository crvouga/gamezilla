@domain:chess
Feature: Puzzle ingest
  Only valid puzzles ever reach the pool. A puzzle is rejected if its line
  holds an illegal move, castles without the right to, ends on the
  opponent's move, starts from a malformed position, or repeats the position
  and solution of a puzzle already stored. The board always faces the
  player who solves the puzzle.

  Scenario: Boot seeds only the three standard puzzles, all valid
    Given the puzzle pool was seeded at boot
    Then the server's puzzle pool is exactly the three standard puzzles
    And every stored puzzle is valid and no position and line repeats

  Scenario: An import lands only its valid puzzles
    When a puzzle file is imported with these puzzles:
      | puzzle                                                    | valid |
      | White solves a mate in one                                | yes   |
      | Black solves a mate in one                                | yes   |
      | a line with an illegal move                               | no    |
      | a line that castles without the castling right            | no    |
      | a line that ends on the opponent's move                   | no    |
      | a malformed position                                      | no    |
      | a standard puzzle's position and solution under a new id  | no    |
    Then the server's puzzle pool is the three standard puzzles plus the two valid imports
    And none of the rejected puzzles is in the pool
    And every stored puzzle is valid and no position and line repeats

  Scenario: Importing the same file again changes nothing
    Given a puzzle file with two valid puzzles and five invalid ones has been imported
    When the same puzzle file is imported again
    Then the server's puzzle pool is unchanged

  Scenario: The board faces the solver, whether White or Black solves
    Given a puzzle file with two valid puzzles and five invalid ones has been imported
    And Alice is a guest
    When Alice creates a space
    And Alice opens puzzles in their space
    And Alice skips puzzles until they have been served one White solves and one Black solves
    Then every puzzle Alice was served was a valid synced puzzle
    And Alice's board faced the solver each time
