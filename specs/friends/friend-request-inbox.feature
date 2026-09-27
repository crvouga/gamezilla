@domain:friends @goal:social:5
Feature: Friend requests reach the inbox
  A request is only useful if the person asked finds out. It arrives in their
  inbox while they are using the app, and a guest, who has no friends, is
  invited to sign in instead of shown an empty inbox.

  Scenario: A friend request arrives in the inbox of the person asked
    Given Alice and Bob are signed in
    And Bob is viewing their inbox
    When Alice sends Bob a friend request from Bob's profile
    Then Bob's inbox shows a friend request from Alice within 15 seconds

  Scenario: A guest opening their inbox is invited to sign in
    Given Alice is a guest
    When Alice opens their inbox
    Then Alice is asked to sign in within 5 seconds
