@domain:sync
Feature: Notes across devices
  People write on whichever device is at hand. Every device a person uses must
  end up with all of their notes, even when they wrote on each one while it
  was apart from the others.

  @goal:works-offline:5 @goal:always-true:2
  Scenario: Notes written on two devices end up on both
    Given Alice uses the app on a phone and a tablet
    And Alice's tablet is offline
    And Alice has written the note "Groceries" on their phone
    When Alice writes the note "Chores" on their tablet
    And Alice's tablet comes back online
    Then Alice's phone shows the notes "Groceries" and "Chores"
    And Alice's tablet shows the notes "Groceries" and "Chores"
