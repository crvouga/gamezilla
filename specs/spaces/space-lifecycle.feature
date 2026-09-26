@domain:spaces @goal:spaces:6
Feature: Find and return to your space

  Scenario: The host reopens their live space after returning to the lobby
    Given Alice is signed in
    When Alice creates a space
    And Alice goes back to the lobby
    And Alice reopens their live space
    Then Alice is in the space
