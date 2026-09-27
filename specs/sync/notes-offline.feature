@domain:sync
Feature: Notes written offline
  When a person writes notes offline, they want them to show at once and to
  reach everyone else once they are back online, with nothing for them to
  do.

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

  @regression:cleared-data-hides-unsent-notes
  Scenario: Notes not yet sent still show after the app's data is cleared offline
    Given Alice has written the note "Groceries" saying "milk"
    When Alice's app has its data cleared
    Then Alice sees the note "Groceries" saying "milk"
    And Bob does not see the note "Groceries"
