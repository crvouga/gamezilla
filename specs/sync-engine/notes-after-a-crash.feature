@domain:sync-engine
Feature: Notes survive a crash
  When their app closes unexpectedly, a person wants every note when it
  reopens, so their writing survives even before anyone else has seen it.

  Rule: A note already shown on a device survives the app closing unexpectedly

    Background:
      Given Alice and Bob are in the shared space "Trip"

    Scenario: After a crash the app still shows every note it had
      Given Alice has written the note "Groceries" saying "milk"
      And Bob has written the note "Hotel" saying "Main St"
      And the note "Hotel" has reached Alice
      When Alice's app crashes and reopens
      Then Alice sees the note "Groceries" saying "milk"
      And Alice sees the note "Hotel" saying "Main St"

    Scenario: A note written offline before a crash still reaches others
      Given Alice's app is offline
      And Alice has written the note "Groceries" saying "milk"
      When Alice's app crashes and reopens
      And Alice's app comes back online
      Then Alice sees the note "Groceries" saying "milk"
      And Bob sees the note "Groceries" saying "milk"
