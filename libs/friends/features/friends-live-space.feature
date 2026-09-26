@domain:friends @goal:social:6 @goal:spaces:7
Feature: Friends in an open space
  The friends list says which friends are in an open space right now, and takes you in.

  Background:
    Given Alice and Bob are friends
    And Bob's friends list shows Alice
    And Bob's friends list does not badge Alice as live

  Scenario: Bob sees Alice is in an open space, live, and joins from his friends list
    When Alice creates a space
    Then Bob's friends list badges Alice as live within 15 seconds
    When Bob joins Alice's space from their friends list
    Then Bob is in the space

  Scenario: When the space ends, the badge goes with it
    When Alice creates a space
    Then Bob's friends list badges Alice as live within 15 seconds
    When Bob joins Alice's space from their friends list
    And Bob steps out of the space
    And Alice ends the space
    Then Bob's friends list stops badging Alice as live within 15 seconds
