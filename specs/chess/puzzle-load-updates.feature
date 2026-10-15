@domain:chess
Feature: Update puzzles already in the pool
  When the team adds puzzles that are already in the puzzle pool, they want
  those puzzles updated, so solvers receive the current puzzles without extra copies.

  Rule: Adding the same puzzles again updates them instead of adding extra copies
    No counter-example: every good earlier puzzle is updated; a broken replacement leaves it alone.

    Scenario: Adding earlier puzzles again reports updates
      Given Alice is on the team for this environment
      And this environment finished adding puzzles
      When Alice adds these puzzles again to this environment
      Then Alice sees 0 puzzles added and 3 puzzles updated

    Scenario: A broken update leaves the earlier puzzles available
      Given Alice is on the team for this environment
      And this environment finished adding puzzles
      And the chosen puzzles are broken updates of the earlier puzzles
      When Alice adds these puzzles again to this environment
      Then Alice sees 0 puzzles updated and 3 broken puzzles
      And a solver can still play from the earlier puzzle pool
