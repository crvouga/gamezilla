@domain:games
Feature: Erase a deleted account's puzzle progress
  When a solver deletes their account, they want their puzzle progress in
  every game erased with it, so nothing of the deleted history stays on any
  device or comes back.

  Rule: Account deletion erases the puzzle rating, game log, stats and saved feed choices on every device
    No counter-example: once account deletion has been confirmed, nothing keeps the account's puzzle progress.

    Scenario: Account deletion erases puzzle progress on the person's other device
      Given Alice is signed in
      And Alice is also signed in on another device
      And Alice has solved 2 puzzles in a row
      When Alice confirms account deletion
      Then Alice's other device cannot show the deleted account's puzzle rating, game log or stats within 30 seconds

    Scenario: A new account starts with the feed choices a new solver has
      Given Alice's account deletion has completed
      And Alice's deleted account had saved a custom feed target
      When Alice signs in with Google
      Then Alice's feed targets 1500 automatically
      And Alice's feed history shows "Unseen"

  Rule: Deleted progress never belongs to a later account and never comes back
    No counter-example: nothing restores a deleted account's puzzle progress.

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

    Scenario: A puzzle finished offline before account deletion cannot bring progress back
      Given Alice is signed in
      And Alice has solved a puzzle while offline
      And Alice's account deletion has been confirmed on another device
      When the connection comes back
      Then Alice's game log cannot show the deleted account's attempts
