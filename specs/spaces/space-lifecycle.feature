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

  Rule: Stepping out stops showing a person as present without leaving their space
    No counter-example: returning makes the person present again; leaving is covered separately.

    @regression:space-step-out-presence-lingers
    Scenario: A friend who steps out stops showing as present
      Given Alice is hosting a space that Bob joined from the link
      When Bob goes back to the lobby
      Then Alice sees 1 person in the space within 20 seconds

    Scenario: Returning after stepping out shows the friend once
      Given Alice and Bob are friends
      And Alice is hosting a space that Bob joined from the lobby
      And Bob has gone back to the lobby
      When Bob joins Alice's space from the lobby
      Then Alice sees 2 people in the space within 20 seconds
