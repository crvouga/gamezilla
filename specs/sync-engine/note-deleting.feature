@domain:sync-engine
Feature: Delete a note
  When a note is no longer needed, whoever owns it wants deleting it to remove
  it for everyone, and writing it again to bring it back for everyone, so
  nobody works from a note the others no longer have.

  Background:
    Given Alice and Bob are in the shared space "Trip"

  Rule: A note deleted by whoever owns it disappears for everyone

    Scenario: A note deleted by the person who wrote it disappears for everyone
      Given Alice has written the note "Groceries" saying "milk"
      And the note "Groceries" has reached Bob
      When Alice deletes the note "Groceries"
      Then Alice does not see the note "Groceries"
      And Bob does not see the note "Groceries"

    Scenario: Whoever last wrote a note owns it and may delete it
      Given Alice has written the note "Groceries" saying "milk"
      And Bob has written the note "Groceries" saying "eggs"
      When Bob deletes the note "Groceries"
      Then Bob does not see the note "Groceries"
      And Alice does not see the note "Groceries"

  Rule: A deleted note written again comes back for everyone

    Scenario: A deleted note written again comes back for everyone with the new text
      Given Alice has written the note "Groceries" saying "milk"
      And Alice has deleted the note "Groceries"
      When Alice writes the note "Groceries" saying "eggs"
      Then Alice sees the note "Groceries" saying "eggs"
      And Bob sees the note "Groceries" saying "eggs"
