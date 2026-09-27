@domain:friends
Feature: Friends in an open space
  The friends list says which friends are in an open space right now, and takes you in.

  Background:
    Given Alice and Bob are friends

  @goal:social:6
  Scenario: A friend in an open space shows as live
    Given Bob is viewing their friends list with Alice in it
    When Alice creates a space
    Then Bob's friends list shows Alice as live within 15 seconds

  @goal:spaces:7
  Scenario: A friend joins a live friend's space from their friends list
    Given Alice is hosting a space
    When Bob joins Alice's space from their friends list
    Then Bob is in the space

  @goal:social:6
  Scenario: A friend's live mark goes when their space ends
    Given Alice is hosting a space
    And Bob's friends list shows Alice as live
    When Alice ends the space
    Then Bob's friends list stops showing Alice as live within 15 seconds
