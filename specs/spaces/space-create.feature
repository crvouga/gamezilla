@domain:spaces
Feature: Create a space
  When a person creates a space, they want it in their lobby straight away, so
  they can return to it whenever they step out.

  Scenario: A host's space is listed in their lobby
    Given Alice is signed in
    And Alice is hosting a space
    When Alice goes back to the lobby
    Then Alice's lobby lists Alice's space
