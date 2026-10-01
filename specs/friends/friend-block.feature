@domain:friends
Feature: Block and unblock
  When a person no longer wants someone to reach them, they want to block
  that person, ending any friendship or friend request between them and
  hiding from them, so the blocked person cannot find them. The blocker can
  unblock later and start over.

  Rule: Blocking ends the friendship and hides the blocker

    Scenario: Blocking someone clears a friend request the blocker sent
      Given Alice and Bob are signed in
      And Alice has sent Bob a friend request
      When Alice blocks Bob
      Then Bob's inbox stops showing the friend request from Alice within 5 seconds

    Scenario: Blocking a stranger hides the blocker without a friendship first
      Given Alice and Bob are signed in
      When Alice blocks Bob
      Then Bob's search for "alice" shows nobody within 15 seconds

    Scenario: Blocking a friend ends the friendship for both
      Given Alice and Bob are friends
      When Alice blocks Bob
      Then Alice's friends list does not show Bob
      And Bob's friends list stops showing Alice within 15 seconds

    Scenario: A blocked person cannot find the blocker
      Given Alice and Bob are friends
      And Alice has blocked Bob
      When Bob searches for "alice"
      Then Bob's search does not show Alice

    Scenario: Blocking someone from their request clears the request
      Given Alice and Bob are signed in
      And Bob has sent Alice a friend request
      When Alice blocks Bob from their request
      Then Alice's inbox stops showing the friend request from Bob within 5 seconds

    Scenario: A blocked person is not told they were blocked
      Given Alice and Bob are signed in
      And Bob has sent Alice a friend request from Alice's profile
      When Alice blocks Bob from their request
      Then Bob can ask Alice again within 5 seconds
      And Bob's search for "alice" shows nobody within 15 seconds

  Rule: The blocker can undo a block

    Scenario: The blocker can still find the person they blocked
      Given Alice and Bob are friends
      And Alice has blocked Bob
      When Alice searches for "bob"
      Then Alice can unblock Bob

    Scenario: After unblocking, the blocker can ask them again
      Given Alice and Bob are friends
      And Alice has blocked Bob
      When Alice unblocks Bob
      Then Alice's search offers to ask Bob
