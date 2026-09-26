@domain:chess
Feature: Puzzle clock and skipping
  A started puzzle's clock runs until the puzzle ends and then stops. A
  skipped puzzle is over and logged as abandoned; the next puzzle starts
  fresh.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: The clock runs while solving and stops on a solve
    Then Alice's puzzle has started
    When 65 seconds pass
    Then Alice's puzzle clock shows at least 60 seconds
    When 5 seconds pass
    Then Alice's puzzle clock has moved on
    When Alice solves the puzzle
    Then Alice's puzzle is solved
    When 30 seconds pass
    Then Alice's puzzle clock has not moved since the solve

  Scenario: Skipping ends the puzzle and logs it as abandoned
    When Alice skips the puzzle
    Then Alice's puzzle is skipped
    And Alice's game log records that puzzle as abandoned

  Scenario: Moving on after a skip starts a fresh puzzle
    When Alice skips the puzzle
    And Alice moves on to the next puzzle
    Then Alice's puzzle is not skipped
