@domain:chess @goal:chess-puzzles:5
Feature: Showing the solution
  Showing the solution plays out the rest of the line, ends play, and counts
  as a fail. An attempt already resolved is not resolved again.

  Background:
    Given Alice is signed in
    And Alice is solving the hook-mate puzzle

  Scenario: The rest of the line plays out to checkmate
    When Alice shows the solution
    Then Alice's board reaches checkmate at move 4 of the line within 20 seconds

  Scenario: Showing the solution counts as a fail and ends play
    When Alice shows the solution
    Then Alice's board reaches checkmate at move 4 of the line within 20 seconds
    And the puzzle's recorded outcomes are "failed"
    And Alice cannot move pieces
    And the puzzle's recorded outcomes are still "failed"
