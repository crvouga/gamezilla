@domain:friends
Feature: Friends need a connection
  When a person is offline and tries to search or ask someone, they want the
  app to say plainly that it needs a connection, so nothing they meant to do
  is quietly lost. Friends happen between people, so they need a connection.

  @regression:people-search-offline-hangs
  Scenario: Searching for people without a connection says it needs one
    Given Alice and Bob are signed in
    And Alice is offline
    When Alice searches for "bob"
    Then Alice is told search needs a connection within 15 seconds

  @regression:friend-request-offline-queued
  Scenario: Asking someone to be a friend without a connection says it needs one
    Given Alice and Bob are signed in
    And Alice is viewing Bob's profile
    And Alice is offline
    When Alice sends Bob a friend request from Bob's profile
    Then Alice is told friend requests need a connection within 15 seconds
    And Bob's inbox does not show a friend request from Alice
