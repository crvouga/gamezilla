@domain:friends
Feature: Friend request declined or cancelled
  When a friend request is no longer wanted, either person wants to end it,
  so the request goes away and nobody becomes friends.

  Background:
    Given Alice and Bob are signed in
    And Alice has sent Bob a friend request

  Rule: Declining a friend request ends it, and asking again straight away is refused

    Scenario: Bob declines and neither is a friend
      When Bob declines Alice's friend request
      Then Bob's inbox does not show a friend request from Alice
      And Bob's friends list does not show Alice
      And Alice's search offers to ask Bob again within 15 seconds
      And Alice's friends list does not show Bob

    Scenario: Asking again straight after a decline is refused with a reason
      Given Bob has declined Alice's friend request
      When Alice asks Bob again
      Then Alice's request to Bob is refused because Bob declined it within the last day
      And Bob's inbox does not show a friend request from Alice

  Rule: Cancelling a friend request lets the asker ask again
    No counter-example: a cancelled request does not impose the declined request's one-day restriction.

    Scenario: Alice cancels and the request is gone from Bob's inbox
      When Alice cancels the friend request to Bob
      Then Alice's search offers to ask Bob
      And Bob's inbox stops showing the friend request from Alice within 15 seconds

    Scenario: Cancelling lets the asker ask again
      Given Alice has cancelled the friend request to Bob
      When Alice asks Bob again
      Then Bob's inbox shows a friend request from Alice within 15 seconds
