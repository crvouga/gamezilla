@domain:chess
Feature: Erase a deleted account's puzzle progress
  When a solver deletes their account, they want puzzle progress to be
  erased with it, so a new account cannot recover the deleted history.

  Rule: Deleted progress never belongs to a later account

    Scenario: A new account starts with a new puzzle rating
      Given Alice's account deletion has completed
      And Alice had a settled puzzle rating on the deleted account
      When Alice signs in with Google
      Then Alice's puzzle rating is 1500 and has not settled

    Scenario: A new account cannot recover the old game log
      Given Alice's account deletion has completed
      And Alice's deleted account had solved puzzles in its game log
      When Alice signs in with Google
      Then Alice's game log cannot show the deleted account's attempts
      And Alice's stats show 0 played and 0 solved
