@domain:sync
Feature: Refused edits
  When something a person did to a note offline breaks the rules by the time
  it reaches everyone else, such as deleting a note someone else has since
  written, they want the refused edit kept from everyone else and a notice of
  it, so they never believe it worked.

  Rule: A refused edit is undone and never reaches anyone else

    Scenario: Deleting offline a note someone else has since written is undone and reaches nobody else
      Given Alice and Bob are in the shared space "Trip"
      And Bob has written the note "Groceries" saying "milk"
      And Bob's app is offline
      And Bob has deleted the note "Groceries"
      And Alice has written the note "Groceries" saying "eggs"
      When Bob's app comes back online
      Then Bob sees the note "Groceries" saying "eggs"
      And Alice sees the note "Groceries" saying "eggs"

  Rule: The author of a refused edit is told until they acknowledge it

    Scenario: The author of a refused edit gets a notice of the refusal
      Given Alice and Bob are in the shared space "Trip"
      And Bob has written the note "Groceries" saying "milk"
      And Bob's app is offline
      And Bob has deleted the note "Groceries"
      And Alice has written the note "Groceries" saying "eggs"
      When Bob's app comes back online
      Then Bob has a notice that deleting the note "Groceries" was refused

    Scenario: An acknowledged notice of a refused edit is gone
      Given Alice and Bob are in the shared space "Trip"
      And Bob has been refused deleting the note "Groceries"
      When Bob acknowledges the notice about the note "Groceries"
      Then Bob has no notices
