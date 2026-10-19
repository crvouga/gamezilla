@domain:games
Feature: Puzzles without an account
  When someone wants to try the game's puzzles, they want to play at once, so
  a guest hosts a space and solves puzzles without ever having to sign in.

  Rule: A guest can solve puzzles and keep their game log
    No counter-example: An account is never needed to solve an allowed puzzle; the daily allowance has its own rules.

    Scenario: A guest solves puzzles in their own space without signing in
      Given Alice is a guest
      And Alice is playing puzzles in their space
      When Alice solves the puzzle
      Then Alice's puzzle is solved
      And Alice still has no account
