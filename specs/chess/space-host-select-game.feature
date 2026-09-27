@domain:chess @goal:spaces:3
Feature: The host chooses what the space plays
  What a space is playing belongs to the space: when the host picks a game,
  everyone in the space is taken to it without doing anything.

  Scenario: The host picks chess and everyone in the space is taken to it
    Given Alice is hosting a space that Bob joined from the link
    When Alice picks chess for the space
    Then Bob is taken to chess within 15 seconds
