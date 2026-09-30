@domain:friends
Feature: Friends in an open space
  When a friend is in an open space, a person wants their friends list to
  show that friend as live and take them into the space, so they can join
  them without asking where.

  Background:
    Given Alice and Bob are friends

  Scenario: A friend in an open space shows as live
    Given Bob is viewing their friends list with Alice in it
    When Alice creates a space
    Then Bob's friends list shows Alice as live within 15 seconds

  Scenario: A friend joins a live friend's space from their friends list
    Given Alice is hosting a space
    When Bob joins Alice's space from their friends list
    Then Bob is in the space

  Scenario: A friend's live mark goes when their space ends
    Given Alice is hosting a space
    And Bob's friends list shows Alice as live
    When Alice ends the space
    Then Bob's friends list stops showing Alice as live within 15 seconds
