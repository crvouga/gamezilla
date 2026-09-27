@domain:chess @goal:social:1
Feature: Puzzles without an account
  People can play without an account: a guest hosts a space and solves
  puzzles without ever being asked to sign in.

  Scenario: A guest solves puzzles in their own space without signing in
    Given Alice is a guest
    And Alice is playing puzzles in their space
    When Alice solves the puzzle
    Then Alice's puzzle is solved
    And Alice still has no account
