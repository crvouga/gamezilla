@domain:spaces @goal:spaces:7
Feature: A friend joins from the lobby
  When a friend is hosting an open space, a person wants to join it from their
  lobby, so they do not need its space link.

  Scenario: A friend joins an open space from the lobby
    Given Alice and Bob are friends
    And Alice is hosting a space
    When Bob joins Alice's space from the lobby
    Then Bob is in the space
