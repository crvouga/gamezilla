@domain:spaces
Feature: Rename a space
  When a space's name needs to say what it is for, its host wants to rename
  the space, so everyone in it and every friend whose lobby lists it sees the
  new name, and never a space name that is not allowed.

  Background:
    Given Alice and Bob are friends
    And Alice is hosting a space that Bob joined from the lobby

  Rule: Only the host renames a space and the new name reaches everyone who sees it

    Scenario: Everyone in the space sees the host's new name for it
      When Alice renames the space to "Friday puzzles"
      Then Bob sees the space is called "Friday puzzles" within 15 seconds

    Scenario: A friend's lobby lists the space by its new name
      Given Bob has gone back to the lobby
      When Alice renames the space to "Friday puzzles"
      Then Bob's lobby lists Alice's space as "Friday puzzles" within 15 seconds

    Scenario: Only the host can rename the space
      When Alice renames the space to "Friday puzzles"
      Then Alice can rename the space
      And Bob cannot rename the space

    Scenario: Clearing the space name names the space after its host again
      Given Alice has renamed the space to "Friday puzzles"
      When Alice clears the space name
      Then Bob sees the space is named after Alice within 15 seconds

  Rule: A space name that is not allowed is refused and the space keeps its name

    Scenario: A space name that only looks like an offensive word is saved
      When Alice renames the space to "Assassin chess club"
      Then Bob sees the space is called "Assassin chess club" within 15 seconds

    Scenario: A space name that is not allowed is refused
      Given Alice has renamed the space to "Friday puzzles"
      When Alice renames the space to "free coins at spam.gg"
      Then Alice is told that space name is not allowed
      And Bob still sees the space is called "Friday puzzles"

    Scenario: A host can save an allowed name after a refused rename
      Given Alice has tried to rename the space to "free coins at spam.gg" and been told it is not allowed
      When Alice renames the space to "Friday puzzles"
      Then Bob sees the space is called "Friday puzzles" within 15 seconds

  Rule: A space name the team stops allowing shows the space named after its host until the team starts allowing it again

    Background:
      Given Alice has renamed the space to "Cheater corner"

    Scenario: A space name the team stops allowing shows the space named after its host
      When the team stops allowing the space name "Cheater corner"
      Then Bob sees the space is named after Alice within 15 seconds

    Scenario: A space name the team starts allowing again shows as it was
      Given the team has stopped allowing the space name "Cheater corner"
      When the team starts allowing the space name "Cheater corner" again
      Then Bob sees the space is called "Cheater corner" within 15 seconds

    Scenario: A space name that is no longer allowed cannot be given again
      Given the team has stopped allowing the space name "Cheater corner"
      When Alice renames the space to "Cheater corner"
      Then Alice is told that space name is not allowed

  Rule: Offline devices apply the naming rules they already know

    Background:
      Given Alice has renamed the space to "Cheater corner"

    @regression:offline-app-learns-unavailable-naming-rules
    Scenario: New naming rules keep an offline host's known space name
      Given Alice is offline
      When the team stops allowing the space name "Cheater corner"
      Then Alice sees the space is called "Cheater corner" within 15 seconds

    Scenario: An offline host still refuses a name their device knows is not allowed
      Given the team has stopped allowing the space name "Cheater corner"
      And Alice is offline
      When Alice renames the space to "Cheater corner"
      Then Alice is told that space name is not allowed

    Scenario: A returning host applies the naming rules they learn
      Given Alice is offline
      And the team has stopped allowing the space name "Cheater corner"
      When the connection comes back
      Then Alice sees the space is named after Alice within 15 seconds

  Rule: A space with no name of its own is named after its host as everyone sees them
    No counter-example: the host's name is theirs to change; nothing done in the space changes it.

    Scenario: A space named after a host whose username the team stops allowing uses their stand-in name
      Given Alice has renamed themselves to @chess_cheater
      When the team stops allowing the username @chess_cheater
      Then Bob sees the space is named after Alice's stand-in name within 15 seconds
