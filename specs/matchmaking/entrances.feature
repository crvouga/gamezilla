@domain:matchmaking
Feature: The same matchmaking at every entrance
  Matchmaking takes requests at several entrances at once, and nobody chooses
  which one their request lands at. People want the same answer wherever
  their request lands, so a wait started at one entrance can be checked,
  changed or stopped at any other.

  Rule: Every entrance sees the same waits

    Scenario: Alice's wait shows at every entrance
      When Alice waits for a match at entrance 1
      Then every entrance sees Alice waiting

    Scenario: Alice stops waiting at another entrance than the one she waited at
      Given Alice is waiting for a match at entrance 1
      When Alice stops waiting at entrance 3
      Then Alice is told she stopped waiting
      And no entrance sees Alice waiting

  Rule: A change of reach counts wherever it lands

    Scenario: Alice's wider reach counts at every entrance
      Given Alice is waiting at entrance 1 with a rating of 1000, accepting anyone within 5 points
      And Bob is waiting at entrance 2 with a rating of 1050, accepting anyone within 200 points
      When Alice widens her reach to 200 points at entrance 2
      And a matching round runs at entrance 1
      Then Alice is told her change counted
      And every entrance sees Alice and Bob matched with each other

  Rule: An entrance opening again keeps everyone's standing

    Scenario: Alice is still waiting after every entrance opens again
      Given Alice is waiting for a match
      When every entrance opens again
      Then every entrance sees Alice waiting
