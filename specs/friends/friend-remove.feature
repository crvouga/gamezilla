@domain:friends @goal:social:5
Feature: Remove a friend
  When a person no longer wants someone as a friend, they want to remove
  them, ending the friendship for both at once, so neither still counts the
  other as a friend. Backing out at the last moment keeps the friendship.

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
