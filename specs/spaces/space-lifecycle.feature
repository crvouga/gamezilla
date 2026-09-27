@domain:spaces @goal:spaces:6
Feature: Find and return to your space
  People step away from their space and come back. An open space stays easy to
  find and return to.

  Scenario: A host returns to their live space from the lobby
    Given Alice is signed in
    And Alice is hosting a space
    And Alice has gone back to the lobby
    When Alice reopens their live space
    Then Alice is in the space
