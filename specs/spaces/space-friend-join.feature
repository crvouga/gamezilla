@domain:spaces @goal:spaces:7
Feature: A friend joins from the lobby
  A person can join a friend's open space without needing the link.

  Scenario: A friend joins an open space from the lobby
    Given Alice and Bob are friends
    And Alice is hosting a space
    When Bob joins Alice's space from the lobby
    Then Bob is in the space
