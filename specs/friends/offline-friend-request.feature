@domain:friends
Feature: Ask a known person to be a friend offline
  When a person is viewing another person's profile without a connection,
  they want to ask them to be a friend and keep that choice, so the friend
  request can be shared when their connection returns.

  Rule: A friend request uses the relationships the person already knows

    @regression:friend-cached-profile-offline-request-refused
    Scenario: Asking offline keeps the request with the asker until it can be shared
      Given Alice and Bob are signed in
      And Alice is viewing Bob's profile
      And Alice is offline
      When Alice sends Bob a friend request from Bob's profile
      Then Alice can cancel the request to Bob
      And Alice is told their friend request will be shared when the connection returns
      And Bob's inbox does not show a friend request from Alice

    Scenario: A known recent decline refuses another request offline
      Given Alice and Bob are signed in
      And Alice has sent Bob a friend request
      And Bob has declined Alice's friend request
      And Alice is viewing Bob's profile
      And Alice is offline
      When Alice sends Bob a friend request from Bob's profile
      Then Alice's request to Bob is refused because Bob declined it within the last day
      And Bob's inbox does not show a friend request from Alice

  Rule: An accepted offline friend request survives reopening and is shared on return
    No counter-example: an unanswered request preserves the asker's choice; a refusal on return is the next rule.

    Scenario: Reopening offline keeps a friend request waiting to be shared
      Given Alice and Bob are signed in
      And Alice has sent Bob a friend request while viewing Bob's profile offline
      When Alice closes and reopens the app
      Then Alice can cancel the request to Bob
      And Alice is not offered to send Bob another friend request
      And Alice is told their friend request will be shared when the connection returns
      And Bob's inbox does not show a friend request from Alice

    Scenario: Returning shares the accepted friend request
      Given Alice and Bob are signed in
      And Alice has sent Bob a friend request while viewing Bob's profile offline
      When the connection comes back
      Then Bob's inbox shows a friend request from Alice within 15 seconds
      And Alice is no longer told their friend request is waiting to be shared

  Rule: A request that can no longer be shared is refused without revealing a block

    Scenario: A request blocked while the asker is offline is refused on return
      Given Alice and Bob are signed in
      And Alice has sent Bob a friend request while viewing Bob's profile offline
      And Bob has blocked Alice
      When the connection comes back
      Then Alice is told their friend request could not be shared because the person is unavailable
      And Alice is not told Bob blocked them
      And Bob's inbox does not show a friend request from Alice

    Scenario: A block undone before sharing allows the offline request
      Given Alice and Bob are signed in
      And Alice has sent Bob a friend request while viewing Bob's profile offline
      And Bob has blocked Alice
      And Bob has unblocked Alice
      When the connection comes back
      Then Bob's inbox shows a friend request from Alice within 15 seconds
      And Alice is no longer told their friend request is waiting to be shared
