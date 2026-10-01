@domain:spaces
Feature: Find and return to your space
  When a host steps out of their open space, they want to find it in their
  lobby and return to it, so stepping out never costs them their space.

  Rule: Stepping out keeps an open space in the host's lobby so they can return

    Scenario: A host returns to their open space from the lobby
      Given Alice is signed in
      And Alice is hosting a space
      And Alice has gone back to the lobby
      When Alice returns to their space
      Then Alice is in the space
