@domain:chess
Feature: Puzzle clock and skipping
  When a solver gives up on a puzzle, they want to skip it and start fresh,
  so the clock counts only the time spent solving and the next puzzle starts
  clean.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Rule: A skipped puzzle is over, and the clock counts only time spent solving
    No counter-example: after the puzzle is over the clock has already stopped, so nothing keeps it running.

    Scenario: The puzzle clock runs while Alice is solving
    When 65 seconds pass
    Then Alice's puzzle clock shows at least 60 seconds

  Scenario: The puzzle clock stops on a solve
    Given Alice has solved the puzzle
    When 30 seconds pass
    Then Alice's puzzle clock has not moved since the solve

  Scenario: A skipped puzzle is over and logged as abandoned
    When Alice skips the puzzle
    Then Alice's puzzle is skipped
    And Alice's game log records that puzzle as abandoned

  Scenario: Moving on after a skip starts a fresh puzzle
    Given Alice has skipped the puzzle
    When Alice moves on to the next puzzle
    Then Alice is solving a different puzzle than the one before

  Scenario: Skipping a puzzle drops the rating
    When Alice skips the puzzle
    Then Alice's puzzle rating is below 1500
