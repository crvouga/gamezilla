@domain:sync-engine
Feature: Notes survive a crash
  When the app crashes, a person wants every note it had to be there when it
  reopens, including notes that had not yet reached anyone else.

  Background:
    Given Alice and Bob are in the shared space "Trip"

  @goal:always-true:1
  Scenario: After a crash the app still shows every note it had
    Given Alice has written the note "Groceries" saying "milk"
    And Bob has written the note "Hotel" saying "Main St"
    And the note "Hotel" has reached Alice
    When Alice's app crashes and reopens
    Then Alice sees the note "Groceries" saying "milk"
    And Alice sees the note "Hotel" saying "Main St"

  @goal:always-true:1
  Scenario: A note written offline before a crash still reaches others
    Given Alice's app is offline
    And Alice has written the note "Groceries" saying "milk"
    When Alice's app crashes and reopens
    And Alice's app comes back online
    Then Alice sees the note "Groceries" saying "milk"
    And Bob sees the note "Groceries" saying "milk"
