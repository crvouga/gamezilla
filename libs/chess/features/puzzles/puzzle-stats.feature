@domain:chess @goal:chess-puzzles:2 @goal:chess-puzzles:11
Feature: Puzzle stats and game log
  A player can see their rating and every puzzle they played. A solve raises
  the rating and is logged as solved; a wrong move is itself the loss, drops
  the rating at once, and is logged as failed. A logged puzzle opens in
  review.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: A solve raises the rating and is logged as solved
    When Alice solves the puzzle
    And Alice opens their stats
    Then Alice's puzzle rating is above 1500
    And Alice's game log records that puzzle as solved

  Scenario: A solved puzzle opens in review from the game log
    When Alice solves the puzzle
    And Alice opens the puzzle's review from their game log
    Then Alice is reviewing that puzzle

  Scenario: A wrong move drops the rating and is logged as failed
    When Alice plays a wrong move
    And Alice opens their stats
    Then Alice's puzzle rating is below 1500
    And Alice's game log records that puzzle as failed
