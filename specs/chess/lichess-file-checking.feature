@domain:chess
Feature: Find the saved Lichess file
  When the team wants to add puzzles, they want to know whether the Lichess
  file is available, so they can reuse it or provide it only when it is missing.

  Rule: Checking must finish before an unknown Lichess file is treated as missing

    Scenario: A completed check offers the file already saved by the team
      Given Alice is on the team for this environment
      And the team has saved a Lichess file
      And Alice is checking for the saved Lichess file
      When checking for the saved Lichess file finishes
      Then Alice is offered to add puzzles from the saved Lichess file
      And Alice is not asked to provide a Lichess file

    Scenario: Checking a previously seen file waits before offering to add puzzles
      Given Alice is on the team for this environment
      And Alice has seen the saved Lichess file
      And Alice is checking for the saved Lichess file
      When Alice follows adding puzzles to this environment
      Then Alice still sees the same saved Lichess file
      And Alice is told the saved Lichess file is being checked
      And Alice is not offered to add puzzles
      And Alice is not offered to check for the saved Lichess file again

    Scenario: An unfinished check does not ask the team for another file
      Given Alice is on the team for this environment
      And checking for the saved Lichess file has not finished
      When Alice follows adding puzzles to this environment
      Then Alice is told the saved Lichess file is being checked
      And Alice is not asked to provide a Lichess file
      And Alice is not offered to add puzzles
      And Alice is not offered to check for the saved Lichess file again

    Scenario: A failed check explains the failure without asking for another file
      Given Alice is on the team for this environment
      And checking for the saved Lichess file fails
      When Alice follows adding puzzles to this environment
      Then Alice is told the saved Lichess file could not be checked
      And Alice is offered to check for the saved Lichess file again
      And Alice is not asked to provide a Lichess file
      And this environment is not adding puzzles

  Rule: Checking again can recover either a saved file or a missing file

    Scenario: Checking again finds the file saved by the team
      Given Alice is on the team for this environment
      And Alice could not check for the saved Lichess file
      And the team has saved a Lichess file
      When Alice checks for the saved Lichess file again
      Then Alice is offered to add puzzles from the saved Lichess file
      And Alice is not asked to provide a Lichess file

    Scenario: Checking again confirms that the first file is still needed
      Given Alice is on the team for this environment
      And Alice could not check for the saved Lichess file
      And no Lichess file has been saved
      When Alice checks for the saved Lichess file again
      Then Alice is asked to provide a Lichess file before adding puzzles
      And this environment is not adding puzzles

    Scenario: Another failed check leaves checking again available
      Given Alice is on the team for this environment
      And checking for the saved Lichess file keeps failing
      When Alice checks for the saved Lichess file again
      Then Alice is told the saved Lichess file could not be checked
      And Alice is offered to check for the saved Lichess file again
      And Alice is not asked to provide a Lichess file

    Scenario: Finding the saved file replaces an earlier first-file choice
      Given Alice is on the team for this environment
      And Alice has chosen the first Lichess file
      And the team has since saved a Lichess file in another environment
      When Alice checks for the saved Lichess file again
      Then Alice is offered the Lichess file already saved by the team
      And Alice is not offered to save another Lichess file

    Scenario: A failed later check keeps the file the team already saw
      Given Alice is on the team for this environment
      And Alice has seen the saved Lichess file
      And checking for the saved Lichess file fails
      When Alice checks for the saved Lichess file again
      Then Alice still sees the same saved Lichess file
      And Alice is told the saved Lichess file could not be checked
      And Alice is not offered to save another Lichess file

  Rule: Checking needs a connection and team access

    Scenario: An offline first opening does not assume that the file is missing
      Given Alice is on the team for this environment
      And Alice has no previous Lichess file check
      And Alice is offline
      When Alice follows adding puzzles to this environment
      Then Alice is told a connection is needed to check for the saved Lichess file
      And Alice is not asked to provide a Lichess file

    Scenario: Checking again while offline keeps the last known file
      Given Alice is on the team for this environment
      And Alice has seen the saved Lichess file
      And Alice is offline
      When Alice checks for the saved Lichess file again
      Then Alice is told a connection is needed to check for the saved Lichess file
      And Alice still sees the same saved Lichess file

    Scenario: Returning online finds a file saved in another environment
      Given Alice is on the team for this environment
      And Alice could not check for the saved Lichess file while offline
      And the team has saved a Lichess file in another environment
      When Alice's device comes back online
      Then Alice is offered to add puzzles from the saved Lichess file
      And Alice is not asked to provide a Lichess file

    Scenario: A person outside the team cannot see or provide the shared file
      Given Alice is signed in and not on the team for this environment
      When Alice follows adding puzzles to this environment
      Then Alice is told only the team can add or stop adding puzzles
      And Alice is not shown the saved Lichess file
      And Alice is not offered to save a Lichess file
