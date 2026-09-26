@domain:chess @goal:chess-puzzles:9
Feature: Retry, hint and solution
  A wrong move gets clear feedback. The player can retry, take a hint, or see
  the solution, and the first wrong move stays the attempt's outcome.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: After a wrong move, retrying takes the move back and the puzzle can still be solved
    When Alice plays a wrong move
    Then Alice is told the move was wrong
    When Alice retries the puzzle
    Then Alice is solving the puzzle
    When Alice solves the puzzle
    Then Alice's puzzle is solved

  Scenario: A first hint highlights the piece, a second hint reveals the move, and the board stays solvable
    Then Alice has no hint showing
    When Alice asks for a hint
    Then Alice's hint highlights the piece to move
    When Alice asks for another hint
    Then Alice's hint shows the solution move
    When Alice solves the puzzle
    Then Alice's puzzle is solved

  Scenario: The solution is offered after a wrong move
    When Alice plays a wrong move
    And Alice asks to see the solution move
    Then Alice's hint shows the solution move
    When Alice retries the puzzle
    And Alice solves the puzzle
    Then Alice's puzzle is solved

  Scenario: A wrong move, then a retry, then a solve is still logged as failed
    When Alice plays a wrong move
    Then Alice is told the move was wrong
    When Alice retries the puzzle
    And Alice solves the puzzle
    Then Alice's game log records that puzzle as failed
