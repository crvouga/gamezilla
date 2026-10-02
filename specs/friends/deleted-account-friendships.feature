@domain:friends
Feature: Remove a deleted account from other people
  When a person deletes their account, other people want friendships and
  requests to reflect that choice, so nobody waits for a deleted account to answer.

  Rule: Confirmed deletion removes the profile and its friendships

    Scenario: A friend no longer sees the deleted account in their friends list
      Given Alice and Bob are friends
      And Alice has a recently proven account
      When Alice confirms account deletion
      Then Bob's friends list stops showing Alice within 15 seconds

    Scenario: People search cannot find a deleted account
      Given Alice's account deletion has been confirmed
      When Bob searches for "alice"
      Then Bob's search does not show Alice
      And Bob cannot open the deleted profile because the account was deleted

  Rule: Waiting friend requests from or to a deleted account cannot be answered

    Scenario: A waiting request disappears when the asker deletes their account
      Given Alice has sent Bob a friend request
      And Alice has a recently proven account
      When Alice confirms account deletion
      Then Bob's inbox stops showing the friend request from Alice within 15 seconds

    Scenario: A request already shown cannot be accepted after deletion
      Given Alice has sent Bob a friend request
      And Alice's account deletion has been confirmed
      When Bob accepts Alice's friend request
      Then Bob is told the request is no longer available because the account was deleted
      And Bob's friends list does not show Alice
