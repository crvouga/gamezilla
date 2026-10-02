@domain:spaces
Feature: Rename a space
  When a host wants a space's name to say what it is for, they rename the
  space, so everyone in it and every friend whose lobby lists it sees the new
  name.

  Rule: Only the host renames a space and the new name reaches everyone who sees it

    Background:
      Given Alice and Bob are friends
      And Alice is hosting a space that Bob joined from the lobby

    Scenario: Everyone in the space sees the host's new name for it
      When Alice renames the space to "Friday puzzles"
      Then Bob sees the space is called "Friday puzzles" within 15 seconds

    Scenario: A friend's lobby lists the space by its new name
      Given Bob has gone back to the lobby
      When Alice renames the space to "Friday puzzles"
      Then Bob's lobby lists Alice's space as "Friday puzzles" within 15 seconds

    Scenario: Only the host can rename the space
      Then Alice can rename the space
      And Bob cannot rename the space
