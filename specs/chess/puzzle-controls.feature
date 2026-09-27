@domain:chess @goal:chess-puzzles:9
Feature: Retry, hint and solution
  A wrong move gets clear feedback. The player can retry, take a hint, or see
  the solution, and the first wrong move stays the attempt's outcome.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: Retrying after a wrong move lets Alice carry on solving
    Given Alice has played a wrong move
    When Alice retries the puzzle
    Then Alice is still asked to find the next move

  Scenario: A first hint highlights the piece to move
    When Alice asks for a hint
    Then Alice's hint highlights the piece to move

  Scenario: A second hint shows the solution move
    Given Alice has taken a hint
    When Alice asks for another hint
    Then Alice's hint shows the solution move

  Scenario: A puzzle can still be solved after both hints
    Given Alice has taken two hints
    When Alice solves the puzzle
    Then Alice's puzzle is solved

  Scenario: A puzzle solved after a retry is still logged as failed
    Given Alice has played a wrong move and retried
    When Alice solves the puzzle
    Then Alice's puzzle is solved
    And Alice's game log records that puzzle as failed

  Scenario: After a wrong move, the solution move can be shown
    Given Alice has played a wrong move
    When Alice asks to see the solution move
    Then Alice's hint shows the solution move
