@domain:matchmaking
Feature: Being matched
  When people are waiting, they want to be paired with someone close to
  their rating whom they accept, and never pushed on someone who does not
  accept them back, so every match is one both people wanted.

  Rule: Two people are matched only when each accepts the other

    Scenario: Two people who accept each other are matched
      Given Alice is waiting with a rating of 1000, accepting anyone within 200 points
      And Bob is waiting with a rating of 1050, accepting anyone within 200 points
      When matchmaking pairs people up
      Then Alice and Bob are matched with each other

    Scenario: Bob's wide range does not match him with Alice, who does not accept him
      Given Alice is waiting with a rating of 1000, accepting anyone within 5 points
      And Bob is waiting with a rating of 1050, accepting anyone within 200 points
      When matchmaking pairs people up
      Then Alice is still waiting
      And Bob is still waiting

    Scenario: Alice waiting alone is not matched with herself
      Given Alice is waiting with a rating of 1000, accepting anyone within 200 points
      When matchmaking pairs people up
      Then Alice is still waiting

  Rule: A person can change their range while they are waiting

    Scenario: Alice's wider range counts
      Given Alice is waiting with a rating of 1000, accepting anyone within 5 points
      When Alice widens her range to 200 points
      Then Alice sees her change counted

    Scenario: Alice's wider range matches her with Bob
      Given Alice is waiting with a rating of 1000, accepting anyone within 5 points
      And Bob is waiting with a rating of 1050, accepting anyone within 200 points
      And Alice has widened her range to 200 points
      When matchmaking pairs people up
      Then Alice and Bob are matched with each other

    Scenario: Alice cannot change her range once she is matched
      Given Alice has been matched with Bob
      When Alice widens her range to 200 points
      Then Alice is told her change did not count
      And Alice is matched with Bob

    Scenario: Alice cannot change her range once she has stopped waiting
      Given Alice has stopped waiting
      When Alice widens her range to 200 points
      Then Alice is told her change did not count
      And Alice is not waiting for a match
