@domain:friends @goal:social:5
Feature: Remove a friend
  People choose who they stay connected to. Removing a friend ends it for both
  people at once, and backing out at the last moment keeps the friendship.

  Background:
    Given Alice and Bob are friends

  Scenario: Changing your mind at the confirmation keeps the friendship
    When Alice starts removing Bob but keeps them
    Then Alice sees Bob as a friend

  Scenario: Removing a friend ends the friendship for both
    When Alice removes Bob
    Then Alice's friends list does not show Bob
    And Bob's friends list stops showing Alice within 15 seconds
    And Alice's friend count is 0
    And Bob's friend count is 0
