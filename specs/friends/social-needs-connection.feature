@domain:friends @goal:works-offline:6
Feature: Friends need a connection
  Everything social happens between people, so it needs a connection.
  Without one, the app says so plainly and nothing is quietly lost.

  Scenario: Searching for people without a connection says it needs one
    Given Alice and Bob are signed in
    And Alice is offline
    When Alice searches for "bob"
    Then Alice is told search needs a connection within 15 seconds

  Scenario: Asking someone to be a friend without a connection says it needs one
    Given Alice and Bob are signed in
    And Alice is viewing Bob's profile
    And Alice is offline
    When Alice sends Bob a friend request from Bob's profile
    Then Alice is told friend requests need a connection within 15 seconds
    And Bob's inbox does not show a friend request from Alice
