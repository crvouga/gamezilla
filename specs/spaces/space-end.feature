@domain:spaces
Feature: End a space

  Scenario: When the host ends the space, the guest's lobby stops listing it
    Given Alice and Bob are friends
    And Alice is hosting a space that Bob joined from the lobby
    When Alice returns to their space and ends it
    Then Bob's lobby stops listing Alice's space within 10 seconds
