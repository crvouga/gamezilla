@domain:friends @goal:social:5
Feature: Another person's profile
  Another person's profile is where you decide about them: it opens from a search
  result or from their request, says who they are, and offers the same choices as search.

  Background:
    Given Alice and Bob are signed in

  Scenario: Asking from their profile, and being answered from yours, makes friends and the counts say so
    Given Alice's friend count is 0
    When Alice looks up Bob
    Then Alice is shown Bob's profile
    When Alice sends Bob a friend request from Bob's profile
    Then Alice can withdraw the request to Bob
    When Bob looks up Alice
    Then Bob is offered to confirm Alice's request within 15 seconds
    When Bob confirms Alice's request from Alice's profile
    Then Bob sees Alice as a friend
    And Alice sees Bob as a friend within 15 seconds
    And Alice's friend count is 1
    And Bob's friend count is 1

  Scenario: A request's View profile shows who is asking, and declining there turns it down
    Given Alice has sent Bob a friend request from Bob's profile
    When Bob views Alice's request
    Then Bob is offered to confirm Alice's request
    When Bob declines Alice's request from Alice's profile
    Then Bob can ask Alice again within 5 seconds
    And Bob's inbox does not show a friend request from Alice
    And Bob's friend count is 0
    And Alice's friend count is 0
