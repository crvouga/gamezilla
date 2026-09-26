@domain:friends @goal:social:5
Feature: Friend request accepted
  Asking someone to be your friend, and them saying yes from their inbox.

  Background:
    Given Alice and Bob are signed in

  Scenario: Bob accepts Alice's request from his inbox and both see each other
    When Alice sends Bob a friend request
    And Bob accepts Alice's friend request
    Then Bob's friends list shows Alice
    And Alice's friends list shows Bob within 15 seconds

  Scenario: Alice is told Bob accepted and reaches his profile from the notice
    When Alice sends Bob a friend request
    And Bob accepts Alice's friend request
    And Alice opens the notice that Bob accepted
    Then Alice sees Bob as a friend
