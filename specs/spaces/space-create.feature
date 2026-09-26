@domain:spaces
Feature: Create a space

  Scenario: The host creates a space and sees it in the lobby
    Given Alice is signed in
    When Alice creates a space
    And Alice goes back to the lobby
    Then Alice's lobby lists Alice's space
