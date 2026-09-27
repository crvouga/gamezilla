@domain:spaces
Feature: Create a space
  A space is where people play together. Creating one should put it in front of
  its host straight away, ready to find again.

  Scenario: A host's space is listed in their lobby
    Given Alice is signed in
    And Alice is hosting a space
    When Alice goes back to the lobby
    Then Alice's lobby lists Alice's space
