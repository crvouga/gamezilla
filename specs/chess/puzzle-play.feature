@domain:chess @goal:chess-puzzles:1
Feature: Puzzle play is a feed
  Play is a feed: finish one puzzle and the next is ready at once, and it is
  never the puzzle just played.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: Moving on after a solve serves a different puzzle at once
    Given Alice has solved the puzzle
    When Alice moves on to the next puzzle
    Then Alice is solving a different puzzle than the one before
