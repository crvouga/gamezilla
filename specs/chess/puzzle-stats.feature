@domain:chess
Feature: Puzzle stats and game log
  When a solver has played puzzles, they want every puzzle they played listed
  with how it went, so they can look back at what each puzzle did to their
  rating.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Rule: Every puzzle in the game log shows its outcome, the puzzle's own rating and its rating change, or that it was unrated
    No counter-example: every played puzzle is logged; an unrated repeat shows that it was unrated instead of a rating change.

    Scenario: A solved puzzle is logged as solved with its own rating and rating change
      When Alice solves the puzzle
      Then Alice's game log records that puzzle as solved
      And Alice's game log shows that puzzle's own rating and its rating change

    Scenario: A puzzle with a wrong move is logged as failed with its own rating and rating change
      When Alice plays a wrong move
      Then Alice's game log records that puzzle as failed
      And Alice's game log shows that puzzle's own rating and its rating change

    Scenario: A repeat of a played puzzle is logged as unrated instead of a rating change
      Given the puzzle pool holds just three puzzles
      And Alice has solved 3 puzzles in a row
      And Alice's feed has come round to a puzzle they already played
      When Alice solves the puzzle
      Then Alice's game log shows the repeat as unrated
