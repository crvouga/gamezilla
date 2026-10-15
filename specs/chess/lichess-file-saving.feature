@domain:chess
Feature: Save the first Lichess file
  When no Lichess file has been saved, the team wants to provide it once,
  so every environment can use the same complete file to add puzzles.

  Rule: The team chooses a file before saving it

    Scenario: Choosing a file offers saving without adding puzzles
      Given Alice is on the team for this environment
      And no Lichess file has been saved
      When Alice chooses a Lichess file
      Then Alice is offered to save the chosen Lichess file
      And this environment is not adding puzzles

    Scenario: Saving is unavailable before the team chooses a file
      Given Alice is on the team for this environment
      And no Lichess file has been saved
      When Alice follows adding puzzles to this environment
      Then Alice is asked to provide a Lichess file before adding puzzles
      And Alice is not offered to save a Lichess file without choosing one

  Rule: A file becomes shared only when saving it finishes

    Scenario: Saving shows progress and prevents another save from starting
      Given Alice is on the team for this environment
      And Alice has chosen the first Lichess file
      When Alice starts saving the chosen Lichess file
      Then Alice can see that the Lichess file is being saved
      And Alice is not offered to choose another Lichess file
      And Alice is not offered to add puzzles
      And Alice is not offered to save a Lichess file
      And Alice is not offered to check for the saved Lichess file again

    Scenario: An unfinished file cannot supply another environment
      Given Alice is on the team for this environment
      And Alice is saving the first Lichess file
      When the team follows adding puzzles in another environment
      Then the other environment does not offer the unfinished Lichess file
      And the other environment is not adding puzzles

    Scenario: Finishing a save offers adding puzzles as a separate choice
      Given Alice is on the team for this environment
      And Alice is saving the first Lichess file
      When saving Alice's Lichess file finishes
      Then Alice is offered to add puzzles from the saved Lichess file
      And this environment is not adding puzzles

    Scenario: A first-file choice reuses the file saved elsewhere before saving starts
      Given Alice is on the team for this environment
      And Alice has chosen the first Lichess file
      And the team has since saved a Lichess file in another environment
      When Alice saves the chosen file
      Then Alice is offered the Lichess file already saved by the team
      And the other environment's saved Lichess file has not been replaced

    Scenario: An existing saved file is kept when another save finishes later
      Given Alice is on the team for this environment
      And Alice started saving a Lichess file before any file was saved
      And the team has since saved a Lichess file in another environment
      When saving Alice's Lichess file finishes
      Then Alice is offered the Lichess file already saved by the team
      And the other environment's saved Lichess file has not been replaced

  Rule: A failed save leaves the first complete file still needed

    Scenario: A file that cannot supply puzzles is refused with an explanation
      Given Alice is on the team for this environment
      And Alice has chosen a file that is not a Lichess file
      When Alice saves the chosen file
      Then Alice is told the file could not be saved and why
      And Alice is offered to choose a Lichess file
      And this environment is not adding puzzles

    Scenario: A failed save can be tried again without losing the choice
      Given Alice is on the team for this environment
      And Alice is saving the first Lichess file
      When saving Alice's Lichess file fails
      Then Alice is told the file could not be saved and why
      And Alice is offered to save the chosen Lichess file
      And the other environment does not offer the unfinished Lichess file

    Scenario: A later save can finish after an earlier failure
      Given Alice is on the team for this environment
      And Alice failed to save the chosen Lichess file
      When Alice saves the chosen Lichess file again
      Then Alice is offered to add puzzles from the saved Lichess file
      And this environment is not adding puzzles

  Rule: Stopping a save requires confirmation and never publishes an unfinished file

    Scenario: Asking to stop saving keeps the save running until confirmation
      Given Alice is on the team for this environment
      And Alice is saving the first Lichess file
      When Alice asks to stop saving the Lichess file
      Then Alice is asked to confirm stopping the Lichess file save
      And Alice can see that the Lichess file is being saved

    Scenario: Cancelling the stop keeps the save running
      Given Alice is on the team for this environment
      And Alice is being asked to confirm stopping the Lichess file save
      When Alice cancels stopping the Lichess file save
      Then Alice can see that the Lichess file is being saved
      And Alice is not asked to confirm stopping the Lichess file save

    Scenario: Confirming the stop leaves no shared incomplete file
      Given Alice is on the team for this environment
      And Alice is being asked to confirm stopping the Lichess file save
      When Alice confirms stopping the Lichess file save
      Then Alice is told saving the Lichess file stopped
      And Alice is offered to save the chosen Lichess file
      And the other environment does not offer the unfinished Lichess file

    Scenario: Saving can finish after the team stopped an earlier attempt
      Given Alice is on the team for this environment
      And Alice has stopped saving the chosen Lichess file
      When Alice saves the chosen file
      Then Alice is offered to add puzzles from the saved Lichess file
      And this environment is not adding puzzles

  Rule: A connection and team access are needed to finish saving

    Scenario: A connected person on the team can save the first file
      Given Alice is on the team for this environment
      And Alice has chosen the first Lichess file
      When Alice saves the chosen file
      Then Alice is offered to add puzzles from the saved Lichess file
      And this environment is not adding puzzles

    @regression:lichess-file-offline-save
    Scenario: Losing the connection leaves an unfinished save unavailable
      Given Alice is on the team for this environment
      And Alice is saving the first Lichess file
      When Alice loses the connection
      Then Alice is told the Lichess file could not finish saving without a connection
      And this environment is not adding puzzles

    Scenario: A person outside the team cannot save the first file
      Given Alice is signed in and not on the team for this environment
      When Alice tries to save a Lichess file
      Then Alice is told only the team can add or stop adding puzzles
      And Alice is not offered to save a Lichess file
