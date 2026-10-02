@domain:matchmaking
Feature: Match restrictions count when people are paired
  When a kind of match says two people cannot play together, people want
  that respected, so close ratings alone never override the restriction.

  Rule: People who cannot be matched together never form a new match

    Scenario: A restriction prevents a close pair from matching
      Given Alice and Bob are waiting within each other's ranges
      When Alice and Bob become unable to be matched together
      Then Alice and Bob are still waiting
      And Alice and Bob cannot be matched together

    Scenario: Unrestricted compatible people are matched
      Given Alice and Bob are waiting within each other's ranges
      When matchmaking pairs people up
      Then Alice and Bob are matched with each other

  Rule: Removing a restriction permits waiting people to match
    No counter-example: removing a restriction changes who a waiting person accepts, never a stopped wait.

    Scenario: A waiting pair can match after their restriction is removed
      Given Alice and Bob are waiting but cannot be matched together
      When Alice and Bob can be matched together again
      Then Alice and Bob can be matched together

    Scenario: Removing a restriction never revives a stopped wait
      Given Alice stopped waiting while she and Bob could not be matched together
      When Alice and Bob can be matched together again
      Then Alice is not waiting

  Rule: A new restriction does not undo a match already formed

    Scenario: An existing match stays when a restriction arises
      Given Alice and Bob are matched with each other
      When Alice and Bob become unable to be matched together
      Then Alice and Bob keep the same match

    Scenario: The same restriction prevents a later match
      Given Alice and Bob cannot be matched together
      And Alice and Bob are waiting within each other's ranges
      When matchmaking pairs people up
      Then Alice and Bob are still waiting
