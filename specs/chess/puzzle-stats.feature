@domain:chess
Feature: Puzzle stats and game log
  When a solver has played puzzles, they want to see their rating and every
  puzzle they played, so a solve and a wrong move each show in the rating
  and in the game log.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Rule: A finished puzzle shows in the rating and in the game log

    Scenario: A solve raises the rating
    When Alice solves the puzzle
    Then Alice's puzzle rating is above 1500

  Scenario: A solved puzzle is logged as solved
    When Alice solves the puzzle
    Then Alice's game log records that puzzle as solved

  Scenario: A wrong move drops the rating at once
    When Alice plays a wrong move
    Then Alice's puzzle rating is below 1500

  Scenario: A wrong move is logged as failed
    When Alice plays a wrong move
    Then Alice's game log records that puzzle as failed
