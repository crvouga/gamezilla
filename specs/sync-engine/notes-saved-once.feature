@domain:sync-engine
Feature: Notes count once
  When a connection is unreliable, a person wants their note to reach
  everyone exactly once, so nobody mistakes repeated copies for new writing.

  Rule: A note shows exactly once however many times the app has to save it

    Background:
      Given Alice and Bob are in the shared space "Trip"
      And Alice's app will not hear back about its next save

    Scenario: A note whose save is never confirmed shows exactly once for everyone
      When Alice writes the note "Groceries" saying "milk"
      Then Alice sees the note "Groceries" once
      And Bob sees the note "Groceries" once

    Scenario: A note whose save is never confirmed shows once even after a crash
      When Alice writes the note "Groceries" saying "milk"
      And Alice's app crashes and reopens
      Then Alice sees the note "Groceries" once
      And Bob sees the note "Groceries" once
