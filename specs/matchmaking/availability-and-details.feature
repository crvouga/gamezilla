@domain:matchmaking
Feature: Available people and private waiting details
  When a person waits for a match, they want only available people to be
  paired and their waiting details to stay private, so a wait never makes
  them play when they cannot or exposes them to someone they have not met.

  Rule: Becoming unavailable ends a wait without undoing a match

    Scenario: Alice's wait ends when she becomes unavailable for a match
      Given Alice is waiting for a match
      When Alice becomes unavailable for a match
      Then Alice is not waiting for a match

    Scenario: Alice cannot be matched after becoming unavailable
      Given Alice was waiting but is unavailable for a match
      And Bob is waiting for a match
      When matchmaking pairs people up
      Then Bob is still waiting
      And Alice is not waiting for a match

    Scenario: Becoming unavailable after pairing cannot erase a match
      Given Alice has been matched with Bob
      When Alice becomes unavailable for a match
      Then Alice and Bob keep the same match

  Rule: Becoming available again requires a new request to wait
    No counter-example: availability alone never expresses a request to wait.

    Scenario: Alice can ask for a new match after becoming available again
      Given Alice's earlier wait ended when she became unavailable
      And Alice is available for a match again
      When Alice waits for a match with a rating of 1500
      Then Alice is waiting

    Scenario: Becoming available does not restart Alice's ended wait
      Given Alice's earlier wait ended when she became unavailable
      When Alice becomes available for a match again
      Then Alice is not waiting for a match

  Rule: Waiting details are private until people are matched

    Scenario: Alice sees her own waiting details
      When Alice waits for a match with a rating of 1500
      Then Alice's wait shows her name and a rating of 1500

    Scenario: Bob cannot see Alice's private wait
      Given Alice is waiting for a match
      When Bob asks to see Alice's wait
      Then Bob is told no wait is available to him

    Scenario: A matched person sees who they are matched with
      Given Alice is waiting with a rating of 1000, accepting anyone within 200 points
      And Bob is waiting with a rating of 1050, accepting anyone within 200 points
      When matchmaking pairs people up
      Then Alice and Bob are matched with each other

  Rule: Different matching pools never pair people together

    Scenario: People waiting in the same matching pool can be matched
      Given Alice and Bob are waiting in the same matching pool within each other's ranges
      When matchmaking pairs people up
      Then Alice and Bob are matched with each other

    Scenario: People in different matching pools cannot be matched
      Given Alice and Bob are waiting in different matching pools within each other's ranges
      When matchmaking pairs people up
      Then Alice and Bob are still waiting
