@domain:friends
Feature: Relationships after time away
  When a person returns after time away, they want their friendships and
  friend requests to reflect what other people did while they were away,
  so old relationships do not leave them stuck or hide a new invitation.

  Rule: An offline friends list keeps the last relationships the person knew
    No counter-example: a person without a connection can only know the relationships they last saw.

    Scenario: A friend's removal while away preserves the last known friends list
      Given Alice and Bob are friends
      And Alice is offline
      And Bob has removed Alice
      When Alice opens their friends list
      Then Alice's friends list shows Bob

  Rule: Returning reflects removals made while away
    No counter-example: returning must reflect a friendship that ended while away.

    Scenario: A removed friendship disappears when the person returns
      Given Alice and Bob are friends
      And Alice is offline
      And Bob has removed Alice
      When the connection comes back
      Then Alice's friends list stops showing Bob within 15 seconds
      And Bob's friends list does not show Alice

  Rule: Returning reveals friend requests sent while away
    No counter-example: an unanswered friend request remains available when the person returns.

    Scenario: An invitation sent while away appears on return
      Given Alice and Bob are signed in
      And Alice is offline
      And Bob has sent Alice a friend request
      When the connection comes back
      Then Alice's inbox shows a friend request from Bob within 15 seconds
