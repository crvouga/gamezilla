@domain:chess @goal:chess-puzzles:9
Feature: Retry, hint and solution
  When a solver is stuck on a puzzle, they want a retry, a hint or the
  solution, so they can learn the line. A wrong move is called out at once,
  and it stays the attempt's outcome whatever help follows.

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
    And Alice's stats show 1 played, 0 solved, and 0% accuracy

  Scenario: Showing the solution after a wrong move still counts one failed puzzle
    Given Alice has played a wrong move
    When Alice shows the solution
    Then Alice's game log records that puzzle as failed
    And Alice's stats show 1 played, 0 solved, and 0% accuracy

  Scenario: After a wrong move, the solution move can be shown
    Given Alice has played a wrong move
    When Alice asks to see the solution move
    Then Alice's hint shows the solution move
