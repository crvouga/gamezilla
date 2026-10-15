@domain:chess
Feature: Follow adding puzzles
  When puzzles are being added, the team wants to follow what has happened,
  so they can see progress and keep the puzzles that are already available.

  Rule: The team can see progress before an addition finishes
    No counter-example: accepted puzzles stay available even when adding the rest fails.

    Scenario: Accepted and broken puzzles appear while the addition continues
      Given Alice is on the team for this environment
      And this environment is adding puzzles
      When this environment adds some of the puzzles
      Then Alice sees 3 puzzles added and 2 broken puzzles
      And Alice sees that this environment is adding puzzles

    Scenario: A failure keeps the progress already made
      Given Alice is on the team for this environment
      And this environment has added some puzzles and is adding more
      When this environment fails to add puzzles
      Then Alice is told adding puzzles failed and why
      And the puzzles already added remain available to solvers

  Rule: Returning online shows the current result
    No counter-example: an offline device keeps the last result it saw until its connection returns.

    Scenario: Progress made while offline appears on return
      Given Alice is on the team for this environment
      And some puzzles were added while Alice was offline
      When Alice's device comes back online
      Then Alice sees 3 puzzles added and 2 broken puzzles
      And Alice sees that this environment is adding puzzles

    Scenario: A stop made while offline appears on return
      Given Alice is on the team for this environment
      And adding puzzles stopped while Alice was offline
      When Alice's device comes back online
      Then Alice sees that this environment stopped adding puzzles

    Scenario: An offline device keeps the earlier result while following an addition
      Given Alice is on the team for this environment
      And some puzzles were added while Alice was offline
      When Alice follows adding puzzles to this environment
      Then Alice sees 0 puzzles added and 0 broken puzzles
      And Alice sees that this environment is adding puzzles
