@domain:friends @goal:social:5
Feature: Friend request accepted
  Asking someone to be your friend, and them saying yes from their inbox.

  Background:
    Given Alice and Bob are signed in
    And Alice has sent Bob a friend request

  Scenario: Accepting a request makes them friends on both sides
    When Bob accepts Alice's friend request
    Then Bob's friends list shows Alice
    And Alice's friends list shows Bob within 15 seconds

  Scenario: The notice of an acceptance leads to the new friend
    Given Bob has accepted Alice's friend request
    When Alice opens the notice that Bob accepted
    Then Alice is shown Bob's profile
    And Alice sees Bob as a friend
