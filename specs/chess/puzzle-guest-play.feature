@domain:chess @goal:social:1
Feature: Puzzles without an account
  People can play without an account: a guest hosts a space and solves
  puzzles without ever being asked to sign in.

  Scenario: A guest hosts a space and solves puzzles with no sign-in anywhere
    Given Alice is a guest
    When Alice creates a space
    And Alice opens puzzles in their space
    And Alice solves the puzzle
    Then Alice's puzzle is solved
    When Alice moves on to the next puzzle
    And Alice solves the puzzle
    Then Alice's puzzle is solved
    And Alice still has no account
