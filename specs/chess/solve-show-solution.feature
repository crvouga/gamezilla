@domain:chess @goal:chess-puzzles:9
Feature: Showing the solution
  Showing the solution plays out the rest of the line, ends play, and counts
  as a fail.

  Background:
    Given Alice is signed in
    And Alice is solving the hook-mate puzzle

  Scenario: The rest of the line plays out to checkmate
    When Alice shows the solution
    Then Alice's board reaches checkmate at move 4 of the line within 20 seconds

  Scenario: Showing the solution ends play
    When Alice shows the solution
    Then Alice's puzzle shows the revealed solution within 20 seconds
    And Alice cannot move pieces

  Scenario: Showing the solution counts as a fail
    When Alice shows the solution
    Then Alice's game log records that puzzle as failed
    And Alice's stats show 1 played, 0 solved, and 0% accuracy

  Scenario: Showing the solution drops the rating
    When Alice shows the solution
    Then Alice's puzzle rating is below 1500
