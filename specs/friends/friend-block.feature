@domain:friends @goal:social:5
Feature: Block and unblock
  Blocking ends a friendship and hides you from the person blocked; unblocking lets you start over.

  Scenario: Blocking a friend ends the friendship for both
    Given Alice and Bob are friends
    When Alice blocks Bob
    Then Alice's friends list does not show Bob
    And Bob's friends list stops showing Alice within 15 seconds

  Scenario: A blocked person cannot find the blocker, so cannot ask again
    Given Alice and Bob are friends
    When Alice blocks Bob
    And Bob searches for "alice"
    Then Bob's search does not show Alice

  Scenario: The blocker can still find them and unblock, after which they can be added again
    Given Alice and Bob are friends
    When Alice blocks Bob
    And Alice unblocks Bob
    Then Alice's search offers to add Bob

  Scenario: A stranger who asks can be blocked from their profile, and their request goes with them
    Given Alice and Bob are signed in
    And Bob has sent Alice a friend request from Alice's profile
    When Alice blocks Bob from their request
    Then Alice's inbox stops showing the friend request from Bob within 5 seconds
    And Bob can ask Alice again within 5 seconds
    And Bob's search for "alice" shows nobody within 15 seconds
    When Alice searches for "bob"
    Then Alice can unblock Bob
