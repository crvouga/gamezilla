@domain:games
Feature: Retry, hint and solution
  When a solver is stuck on a puzzle of the game, they want a retry, a hint or
  the solution, so they can learn the line without the attempt's outcome
  changing.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Rule: A hint shows the next help, and the puzzle can still be solved
    No counter-example: a hint is help while solving, not a refusal of a legal solve.

    Scenario: A first hint highlights where the solution move starts
      When Alice asks for a hint
      Then Alice's hint highlights where the solution move starts

    Scenario: A second hint shows the solution move
      Given Alice has taken a hint
      When Alice asks for another hint
      Then Alice's hint shows the solution move

    Scenario: A puzzle can still be solved after both hints
      Given Alice has taken two hints
      When Alice solves the puzzle
      Then Alice's puzzle is solved

  Rule: Retrying continues the same attempt, so its outcome does not change

    Scenario: A puzzle without a wrong move or a result offers no retry
      When Alice tries to retry before a wrong move or result
      Then Alice is not offered to retry
      And Alice is still asked to find the next move

    Scenario: Retrying after a wrong move lets Alice carry on solving
      Given Alice has played a wrong move
      When Alice retries the puzzle
      Then Alice is still asked to find the next move

    Scenario: A puzzle solved after a retry is still logged as failed
      Given Alice has played a wrong move and retried
      When Alice solves the puzzle
      Then Alice's puzzle is solved
      And Alice's game log records that puzzle as failed
      And Alice's stats show 1 played, 0 solved, and 0% accuracy

    Scenario: Retrying a solved puzzle keeps the solved outcome
      Given Alice has solved the puzzle
      When Alice retries the puzzle
      Then Alice is asked to find the next move
      And Alice's game log records that puzzle as solved

    Scenario: Retrying a shown solution keeps the failed outcome
      Given Alice has shown the solution
      When Alice retries the puzzle
      Then Alice is asked to find the next move
      And Alice's game log records that puzzle as failed

    Scenario: Retrying a skipped puzzle keeps the abandoned outcome
      Given Alice has skipped the puzzle
      When Alice retries the puzzle
      Then Alice is asked to find the next move
      And Alice's game log records that puzzle as abandoned

  Rule: Showing the solution fails the attempt
    No counter-example: Showing the solution during play always counts as failed; finished puzzles offer no further solution.

    @regression:puzzle-solution-after-hint-overclick
    Scenario: Showing the line after a hint finishes without an extra move
      Given Alice has taken a hint
      When Alice shows the solution
      Then Alice's puzzle remains revealed
      And Alice's game log records that puzzle as failed

    Scenario: Showing the solution after a wrong move still counts one failed puzzle
      Given Alice has played a wrong move
      When Alice shows the solution
      Then Alice's game log records that puzzle as failed
      And Alice's stats show 1 played, 0 solved, and 0% accuracy

    Scenario: Showing the solution of a clean attempt fails it
      When Alice shows the solution
      Then Alice's game log records that puzzle as failed
      And Alice's stats show 1 played, 0 solved, and 0% accuracy

  Rule: Skipping after a wrong move keeps the first failed result
    No counter-example: Skipping stops practice but cannot replace a decided result.

    Scenario: A wrong move followed by a skip remains failed
      Given Alice has played a wrong move
      When Alice skips the puzzle
      Then Alice's puzzle remains skipped
      And Alice's game log records that puzzle as failed
