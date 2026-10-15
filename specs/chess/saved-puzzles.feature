@domain:chess
Feature: Reuse the Lichess file across environments
  When another environment needs puzzles, the team wants to reuse the saved
  Lichess file, so nobody has to provide the same puzzles again.

  Rule: A saved Lichess file can supply puzzles to every environment

    Scenario: Another environment can add puzzles from the saved Lichess file
      Given Alice is on the team for this environment
      And the team has saved a Lichess file in another environment
      When Alice adds puzzles to this environment
      Then Alice sees that this environment is adding puzzles
      And Alice is not asked to provide a Lichess file

    Scenario: Adding puzzles without a saved Lichess file asks for one
      Given Alice is on the team for this environment
      And no Lichess file has been saved
      When Alice tries to add puzzles to this environment
      Then Alice is asked to provide a Lichess file before adding puzzles
      And this environment is not adding puzzles

  Rule: The team provides the Lichess file only when none has been saved

    Scenario: Saving the first Lichess file makes it available for adding puzzles
      Given Alice is on the team for this environment
      And no Lichess file has been saved
      When Alice saves a Lichess file
      Then Alice is offered to add puzzles from the saved Lichess file
      And Alice is not asked to provide a Lichess file

    Scenario: A saved Lichess file is offered without asking for another
      Given Alice is on the team for this environment
      And the team has saved a Lichess file
      When Alice follows adding puzzles to this environment
      Then Alice is not offered to save another Lichess file
      And Alice is offered to add puzzles from the saved Lichess file

    Scenario: Saving without a connection asks the team to return online
      Given Alice is on the team for this environment
      And no Lichess file has been saved
      And Alice is offline
      When Alice saves a Lichess file
      Then Alice is told a connection is needed to save a Lichess file
      And this environment is not adding puzzles
