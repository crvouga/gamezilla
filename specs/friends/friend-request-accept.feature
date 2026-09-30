@domain:friends
Feature: Friend request accepted
  When someone a person wants as a friend asks them, the person wants to
  accept from their inbox, so both become friends at once and the asker
  finds out from a notice.

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
