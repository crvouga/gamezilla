@domain:chess @goal:spaces:3
Feature: The host chooses what the space plays
  When a host picks a game, everyone in the space wants to be taken to it
  without doing anything, because what a space plays belongs to the space.

  Scenario: The host picks chess and everyone in the space is taken to it
    Given Alice is hosting a space that Bob joined from the link
    When Alice picks chess for the space
    Then Bob is taken to chess within 15 seconds
