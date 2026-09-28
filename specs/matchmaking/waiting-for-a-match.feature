@domain:matchmaking
Feature: Waiting for a match
  When a person wants someone to play, they want to wait for a match, see
  where they stand and stop waiting until they are matched, so nobody is
  kept waiting against their will and nobody loses a match they already
  have.

  Rule: A person waits for one match at a time

    Scenario: Alice's wait shows her name and rating
      When Alice waits for a match with a rating of 1500
      Then Alice is waiting
      And Alice's wait shows her name and a rating of 1500

    Scenario: Once matched, Alice can wait for a match again
      Given Alice has been matched with Bob
      When Alice waits for a match with a rating of 1500
      Then Alice is waiting
      And Alice's wait shows her name and a rating of 1500

    Scenario: Alice cannot wait a second time while she is waiting
      Given Alice is waiting with a rating of 1000, accepting anyone within 200 points
      When Alice waits for a match with a rating of 1500
      Then Alice is told she is already waiting
      And Alice's wait shows her name and a rating of 1000

  Rule: A person can stop waiting until they are matched

    Scenario: Alice stops waiting and is no longer waiting
      Given Alice is waiting for a match
      When Alice stops waiting
      Then Alice sees she stopped waiting
      And Alice is not waiting for a match

    Scenario: Alice cannot stop waiting once she is matched with Bob
      Given Alice has been matched with Bob
      When Alice stops waiting
      Then Alice is told there was nothing to stop
      And Alice is matched with Bob

    Scenario: Alice has nothing to stop once she has stopped waiting
      Given Alice has stopped waiting
      When Alice stops waiting
      Then Alice is told there was nothing to stop
      And Alice is not waiting for a match
