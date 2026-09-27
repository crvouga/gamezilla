@domain:matchmaking
Feature: Waiting for a match
  When a person wants someone to play, they wait for a match, see where they
  stand while they wait, and can stop waiting until they are matched, so
  nobody is kept waiting against their will and nobody loses a match they
  already have.

  Rule: A person waiting sees they are waiting, with the details they waited with

    Scenario: Alice's wait shows her rating and name
      When Alice waits for a match with a rating of 1500
      Then Alice is waiting
      And Alice's wait shows her name and a rating of 1500

  Rule: Nothing is known of a wait nobody started

    Scenario: Asking after a wait nobody started finds nothing
      When someone asks after a wait nobody started
      Then nothing is found

  Rule: A person waiting can stop waiting

    Scenario: Alice stops waiting and is no longer waiting
      Given Alice is waiting for a match
      When Alice stops waiting
      Then Alice is told she stopped waiting
      And Alice is not waiting for a match

  Rule: Stopping a wait nobody started changes nothing

    Scenario: Stopping a wait nobody started has nothing to stop
      When someone stops a wait nobody started
      Then they are told there was nothing to stop

  Rule: A matched person stays matched

    Scenario: Alice cannot stop waiting once she is matched with Bob
      Given Alice has been matched with Bob
      When Alice stops waiting
      Then Alice is told there was nothing to stop
      And Alice is matched with Bob
