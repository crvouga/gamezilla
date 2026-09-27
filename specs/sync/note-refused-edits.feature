@domain:sync
Feature: Refused edits
  An edit made offline can turn out to break the rules once it reaches
  everyone else, such as deleting a note someone else has since taken over. A
  refused edit must never spread to other people, and its author must be told
  rather than left believing it worked.

  Rule: A refused edit is undone and never reaches anyone else

    Scenario: A delete refused after coming back online is undone and never reaches anyone else
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
