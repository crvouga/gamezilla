@domain:chess
Feature: Only puzzles that can be solved
  When the team adds puzzles, solvers want only puzzles that can really be
  solved, so no broken puzzle ever wastes their time.

  Rule: A broken puzzle the team adds never reaches a solver
    No counter-example: nothing a solver does brings a broken puzzle to the board.

    Scenario: Broken puzzles the team added are never served
      Given the team has added seven puzzles, five of them broken
      And Alice is a guest
      And Alice is playing puzzles in their space
      When Alice plays through every puzzle the feed offers
      Then none of the broken puzzles was served to Alice
