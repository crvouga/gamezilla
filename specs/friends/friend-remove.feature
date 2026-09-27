@domain:friends @goal:social:5
Feature: Remove a friend

  Background:
    Given Alice and Bob are friends

  Scenario: Changing your mind at the confirmation keeps the friendship
    When Alice starts removing Bob but keeps them
    Then Alice sees Bob as a friend

  Scenario: Removing a friend ends the friendship for both, and Bob's list follows live
    When Alice removes Bob
    Then Alice's friends list does not show Bob
    And Bob's friends list stops showing Alice within 15 seconds
    And Alice's friend count is 0
    And Bob's friend count is 0
