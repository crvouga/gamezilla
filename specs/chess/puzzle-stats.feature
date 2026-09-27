@domain:chess @goal:chess-puzzles:2 @goal:chess-puzzles:11
Feature: Puzzle stats and game log
  When a solver has played puzzles, they want to see their rating and every
  puzzle they played. A solve raises the rating and is logged as solved; a
  wrong move is itself the failure, drops the rating at once, and is logged
  as failed.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

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
