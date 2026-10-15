@domain:chess
Feature: Return to adding puzzles
  When the team leaves while puzzles are being added, they want to return
  to the current result, so leaving does not lose work or start it again.

  Rule: Leaving an addition does not stop it or start another
    No counter-example: stopping remains a separate, confirmed choice.

    Scenario: Returning to an ongoing addition shows its progress
      Given Alice is on the team for this environment
      And this environment has added some puzzles and is adding more
      And Alice has left adding puzzles
      When Alice follows adding puzzles to this environment
      Then Alice sees that this environment is adding puzzles
      And Alice sees 3 puzzles added and 2 broken puzzles

    Scenario: Returning after an addition finishes shows the final result
      Given Alice is on the team for this environment
      And adding puzzles finished while Alice was away
      When Alice follows adding puzzles to this environment
      Then Alice sees that this environment finished adding puzzles
      And Alice sees how many puzzles were added
      And Alice sees how many puzzles were broken

    Scenario: Returning after an addition fails shows the failure and keeps earlier puzzles
      Given Alice is on the team for this environment
      And adding puzzles failed while Alice was away
      When Alice follows adding puzzles to this environment
      Then Alice is told adding puzzles failed and why
      And a solver can still play from the earlier puzzle pool

  Rule: An unfinished save is not a saved Lichess file after leaving

    Scenario: Returning after leaving an unfinished save asks for a complete file
      Given Alice is on the team for this environment
      And Alice left before the first Lichess file finished saving
      When Alice follows adding puzzles to this environment
      Then Alice is asked to provide a Lichess file before adding puzzles
      And this environment is not adding puzzles

    Scenario: A completed file remains available after leaving
      Given Alice is on the team for this environment
      And Alice has left after the Lichess file finished saving
      When Alice follows adding puzzles to this environment
      Then Alice is offered to add puzzles from the saved Lichess file
      And this environment is not adding puzzles

  Rule: Every addition keeps the shared file available for later use
    No counter-example: finishing, failing and stopping an addition never remove the saved file.

    Scenario Outline: Returning after an addition keeps the same shared file
      Given Alice is on the team for this environment
      And this environment <outcome>
      When Alice follows adding puzzles to this environment
      Then Alice still sees the same saved Lichess file
      And Alice is not offered to save another Lichess file

      Examples:
        | outcome                 |
        | finished adding puzzles |
        | failed to add puzzles   |
        | stopped adding puzzles  |
