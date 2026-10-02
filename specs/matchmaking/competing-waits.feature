@domain:matchmaking
Feature: Competing waits and keeping a match
  When several people accept one another, they want a complete match that
  is kept, so nobody is paired twice or loses out to a later compatible wait.

  Rule: Earlier compatible waits have the first opportunity to be matched

    Scenario: Alice is paired with Bob before Carol's later compatible wait
      Given Alice, Bob and Carol are waiting in that order within each other's ranges
      When matchmaking pairs people up
      Then Alice and Bob are matched with each other

    Scenario: An earlier incompatible wait does not hold back a compatible pair
      Given Alice is waiting with a rating of 1000, accepting anyone within 5 points
      And Bob is waiting with a rating of 1050, accepting anyone within 200 points
      And Carol is waiting with a rating of 1100, accepting anyone within 200 points
      When matchmaking pairs people up
      Then Bob and Carol are matched with each other
      And Alice is still waiting

  Rule: A completed match uses each wait once

    Scenario: Four compatible people receive two separate matches
      Given Alice, Bob, Carol and Dave are waiting in that order within each other's ranges
      When matchmaking pairs people up
      Then Alice and Bob are matched with each other
      And Carol and Dave are matched with each other

    Scenario: Pairing again cannot use a matched wait again
      Given Alice has been matched with Bob
      And Carol is waiting for a match
      When matchmaking pairs people up
      Then Alice and Bob keep the same match
      And Carol is still waiting

  Rule: Stopping first prevents a match and being matched first keeps the match

    Scenario: A person stops while a compatible person is waiting
      Given Alice and Bob are waiting within each other's ranges
      When Alice stops waiting
      Then Alice sees she stopped waiting
      And Bob is waiting

    Scenario: A stopped wait is not paired with a later compatible person
      Given Alice has stopped waiting
      And Bob is waiting for a match
      When matchmaking pairs people up
      Then Alice is not waiting for a match
      And Bob is still waiting

    Scenario: Alice cannot undo the match by stopping after it was made
      Given Alice has been matched with Bob
      When Alice stops waiting
      Then Alice is told there was nothing to stop
      And Alice and Bob keep the same match

  Rule: Starting a later wait does not change an earlier match
    No counter-example: the later wait is separate from the earlier match.

    Scenario: Bob keeps his match when Alice asks for a later one
      Given Alice has been matched with Bob
      When Alice waits for a match with a rating of 1500
      Then Alice is waiting
      And Bob keeps his earlier match with Alice
