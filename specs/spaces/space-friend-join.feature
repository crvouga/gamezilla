@domain:spaces @goal:spaces:7
Feature: A friend joins from the lobby
  A person can join a friend's open space without needing the link.

  Scenario: The host creates a space and a friend joins it from the lobby card
    Given Alice and Bob are friends
    When Alice creates a space
    And Bob joins Alice's space from the lobby
    Then Bob is in the space
