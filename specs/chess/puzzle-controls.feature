@domain:chess
Feature: A chess hint points at a piece
  When a solver is stuck on a chess puzzle, they want the first hint to point
  at the piece to move, so they still find where it goes themselves.

  Rule: A chess puzzle's first hint highlights the piece to move
    No counter-example: a hint is help while solving, not a refusal; the second hint and its limits are every game's.

    Scenario: A first hint highlights the piece to move
      Given Alice is signed in
      And Alice is playing puzzles in their space
      When Alice asks for a hint
      Then Alice's hint highlights the piece to move
