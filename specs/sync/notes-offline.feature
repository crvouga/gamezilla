@domain:sync
Feature: Notes written offline
  People write notes wherever they are, connected or not. What they write
  offline must show for them right away and reach everyone else once they are
  back online, without them having to do anything.

  Background:
    Given Alice and Bob are in the shared space "Trip"
    And Alice's app is offline

  Scenario: A note written offline shows for its writer but waits to reach others
    When Alice writes the note "Groceries" saying "milk"
    Then Alice sees the note "Groceries" at once
    And Bob does not see the note "Groceries"

  @goal:always-true:1
  Scenario: A note written offline reaches others once the app is back online
    Given Alice has written the note "Groceries" saying "milk"
    When Alice's app comes back online
    Then Bob sees the note "Groceries" saying "milk"
