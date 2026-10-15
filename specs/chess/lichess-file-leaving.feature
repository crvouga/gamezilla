@domain:chess
Feature: Leave while saving a Lichess file
  When a Lichess file is still being saved, the team wants to choose whether
  to leave, so an accidental departure does not stop their work.

  Background:
    Given Alice is on the team for this environment

  Rule: Leaving an unfinished Lichess file needs confirmation

    Scenario: Asking to leave keeps saving until the team chooses
      Given Alice is saving the first Lichess file
      When Alice asks to leave adding puzzles
      Then Alice is asked to confirm leaving because the Lichess file is still being saved
      And Alice can see that the Lichess file is being saved

    Scenario: Cancelling departure keeps the chosen file being saved
      Given Alice is choosing whether to leave while saving a Lichess file
      When Alice cancels leaving adding puzzles
      Then Alice can see that the Lichess file is being saved
      And Alice is not asked to confirm leaving adding puzzles

    Scenario: Confirming departure stops the unfinished save
      Given Alice is choosing whether to leave while saving a Lichess file
      When Alice confirms leaving adding puzzles
      Then Alice is away from adding puzzles
      And the other environment does not offer the unfinished Lichess file

    Scenario: Leaving after saving finishes needs no confirmation
      Given the team has saved a Lichess file
      When Alice asks to leave adding puzzles
      Then Alice is away from adding puzzles
      And Alice is not asked to confirm leaving adding puzzles

    Scenario: Finishing while the choice is open keeps the completed file
      Given Alice is choosing whether to leave while saving a Lichess file
      When saving Alice's Lichess file finishes
      Then Alice is away from adding puzzles
      And the team can still add puzzles from the saved Lichess file
      And Alice is not asked to confirm leaving adding puzzles

    Scenario: Losing the connection makes a requested departure safe
      Given Alice is choosing whether to leave while saving a Lichess file
      When Alice loses the connection
      Then Alice is away from adding puzzles
      And Alice is not asked to confirm leaving adding puzzles
