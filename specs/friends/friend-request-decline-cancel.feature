@domain:friends @goal:social:5
Feature: Friend request declined or cancelled
  A request can be turned down by the person asked, or withdrawn by the one who asked.

  Background:
    Given Alice and Bob are signed in
    And Alice has sent Bob a friend request

  Scenario: Bob declines and neither is a friend
    When Bob declines Alice's friend request
    Then Bob's inbox does not show a friend request from Alice
    And Bob's friends list does not show Alice
    And Alice's search offers to add Bob again within 15 seconds
    And Alice's friends list does not show Bob

  Scenario: Asking again straight after a decline is refused with a reason
    When Bob declines Alice's friend request
    And Alice's search offers to add Bob again within 15 seconds
    And Alice asks Bob again
    Then Alice's request to Bob is refused with "Try again later"
    And Bob's inbox does not show a friend request from Alice

  Scenario: Alice cancels and the request leaves Bob's inbox
    When Alice cancels the friend request to Bob
    Then Alice's search offers to add Bob
    And Bob's inbox stops showing the friend request from Alice within 15 seconds
