@domain:sync-engine
Feature: Notes count once
  When a person writes a note, they want it to show once for everyone it is
  shared with, so nobody mistakes repeated copies for new writing.

  Rule: A note shows once for every person in its shared space
    No counter-example: two copies of the same note are never an allowed outcome.

    Background:
      Given Alice and Bob are in the shared space "Trip"

    Scenario: A written note shows once for everyone it is shared with
      When Alice writes the note "Groceries" saying "milk"
      Then Alice sees the note "Groceries" once
      And Bob sees the note "Groceries" once

    Scenario: A written note shows once after its writer's app crashes
      Given Alice has written the note "Groceries" saying "milk"
      When Alice's app crashes and reopens
      Then Alice sees the note "Groceries" once
      And Bob sees the note "Groceries" once
