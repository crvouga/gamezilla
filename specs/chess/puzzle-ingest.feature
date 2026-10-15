@domain:chess
Feature: Add puzzles to an environment
  When an environment needs fresh puzzles, the team wants to add them and
  follow the result, so solvers receive good puzzles without broken ones.

  Rule: Only the team may add puzzles

    @regression:puzzle-import-status-subscription-loop
    Scenario: A person on the team starts adding puzzles
      Given Alice is on the team for this environment
      When Alice adds puzzles to this environment
      Then Alice sees that this environment is adding puzzles

    Scenario: A person outside the team cannot add puzzles
      Given Alice is signed in and not on the team for this environment
      When Alice tries to add puzzles to this environment
      Then Alice is told only the team can add or stop adding puzzles
      And this environment is not adding puzzles

  Rule: An environment adds puzzles only once at a time

    Scenario: Another addition is refused while one is in progress
      Given Alice is on the team for this environment
      And this environment is adding puzzles
      When Alice tries to add puzzles to this environment
      Then Alice is told this environment is already adding puzzles
      And this environment is still adding puzzles

    Scenario: A team can start again after it finished adding puzzles
      Given Alice is on the team for this environment
      And this environment finished adding puzzles
      When Alice adds puzzles to this environment
      Then Alice sees that this environment is adding puzzles

    Scenario: A team can start again after it failed to add puzzles
      Given Alice is on the team for this environment
      And this environment failed to add puzzles
      When Alice adds puzzles to this environment
      Then Alice sees that this environment is adding puzzles

  Rule: Puzzles are added only to their environment
    No counter-example: adding puzzles to one environment cannot choose another environment as its destination.

    Scenario: Adding puzzles changes this environment's puzzle pool
      Given Alice is on the team for this environment
      When Alice adds puzzles to this environment
      Then this environment's puzzle pool holds the added puzzles

    Scenario: Adding puzzles leaves another environment unchanged
      Given Alice is on the team for this environment
      And another environment has its own puzzle pool
      When Alice adds puzzles to this environment
      Then the other environment's puzzle pool is still unchanged

  Rule: The team can follow adding puzzles to its outcome

    Scenario: A finished addition reports what entered the puzzle pool
      Given Alice is on the team for this environment
      And this environment is adding puzzles
      When this environment finishes adding puzzles
      Then Alice sees how many puzzles were added
      And Alice sees how many puzzles were broken

    Scenario: A failed addition leaves the earlier puzzle pool available
      Given Alice is on the team for this environment
      And this environment is adding puzzles
      When this environment fails to add puzzles
      Then Alice is told adding puzzles failed and why
      And a solver can still play from the earlier puzzle pool

    Scenario: A finished addition appears when the connection returns
      Given Alice is on the team for this environment
      And adding puzzles finished while Alice was offline
      When Alice's device comes back online
      Then Alice sees how many puzzles were added
      And Alice sees how many puzzles were broken

  Rule: A broken puzzle the team adds never reaches a solver
    No counter-example: nothing a solver does brings a broken puzzle to the board.

    Scenario: Broken puzzles the team added are never served
      Given the team has added seven puzzles, five of them broken
      And Alice is a guest
      And Alice is playing puzzles in their space
      When Alice plays through every puzzle the feed offers
      Then none of the broken puzzles was served to Alice
