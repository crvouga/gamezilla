@domain:chess @goal:spaces:3
Feature: The host chooses what the space plays
  What a space is playing belongs to the space: when the host picks a game,
  everyone in the space is taken to it without doing anything.

  Scenario: The host picks chess and everyone in the space is taken to it
    Given Alice is a guest
    And Bob is a guest
    When Alice creates a space
    Then Alice has a link to the space
    When Bob joins the space from the link
    And Alice picks chess for the space
    Then Bob is taken to chess within 15 seconds
