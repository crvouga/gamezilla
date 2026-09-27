@domain:chess @goal:chess-puzzles:1
Feature: Puzzle play is a feed
  Play is a feed: finish one puzzle and the next is ready at once, and it is
  never the puzzle just played.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: The host solves a mate-in-one puzzle by moving a piece on the board
    When Alice solves the puzzle
    Then Alice's puzzle is solved

  Scenario: Moving on never repeats the puzzle just played
    When Alice solves the puzzle
    And Alice moves on to the next puzzle
    Then Alice is solving a different puzzle than the one before
    When Alice solves the puzzle
    And Alice moves on to the next puzzle
    Then Alice is solving a different puzzle than the one before
