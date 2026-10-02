@domain:spaces
Feature: End a space
  When a host ends their space, their friends want it gone from their lobby,
  so nobody keeps finding a space that is over.

  Rule: Ending a space removes it from the lobby of everyone who could find it

    Scenario: When the host ends the space, a friend's lobby stops listing it
      Given Alice and Bob are friends
      And Alice is hosting a space that Bob joined from the lobby
      When Alice ends the space
      Then Bob's lobby stops listing Alice's space within 10 seconds
