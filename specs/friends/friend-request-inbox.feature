@domain:friends
Feature: Friend requests reach the inbox
  When someone asks a person to be friends, the person asked wants the friend
  request to reach their inbox while they are using the app, so they find
  out without looking for it, and know who is asking without ever seeing a
  username that is no longer allowed. A guest, who has no friends, is asked
  to sign in instead of shown an empty inbox.

  Rule: A friend request reaches the person asked and an inbox needs an account

    Scenario: A friend request arrives in the inbox of the person asked
      Given Alice and Bob are signed in
      And Bob is viewing their inbox
      When Alice sends Bob a friend request from Bob's profile
      Then Bob's inbox shows a friend request from Alice within 15 seconds

    Scenario: A guest opening their inbox is invited to sign in
      Given Alice is a guest
      When Alice opens their inbox
      Then Alice is asked to sign in within 5 seconds

  Rule: A friend request names its asker as everyone sees them
    No counter-example: the person asked cannot change how the asker is named; the asker renaming themselves names them anew.

    Scenario: A friend request from someone whose username the team stops allowing names them by their stand-in name
      Given Alice and Bob are signed in
      And Alice has renamed themselves to @chess_cheater
      And Alice has sent Bob a friend request from Bob's profile
      When the team stops allowing the username @chess_cheater
      Then Bob's inbox shows a friend request from Alice's stand-in name within 15 seconds
      And Bob's inbox does not show @chess_cheater
