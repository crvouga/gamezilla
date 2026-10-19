@domain:chess
Feature: Castling in a puzzle
  When a solver's answer to a chess puzzle is to castle, they want either way
  of castling to count, so the move they know is never refused. Castling by
  moving the king two squares and by moving the king onto its own rook are
  the same move, and a wrong move before it stays the attempt's outcome.

  Rule: Castling either way solves the castling puzzle, and a retry keeps the failed result
    No counter-example: both ways of castling are the same move; a wrong move is every game's, in the solve flow.

    Background:
      Given Alice is signed in
      And Alice is solving the castling puzzle

    Scenario: Castling by moving the king two squares solves the puzzle
      When Alice castles by moving the king two squares
      Then Alice's puzzle is solved within 20 seconds

    Scenario: Castling by moving the king onto its rook solves the puzzle
      When Alice castles by moving the king onto its own rook
      Then Alice's puzzle is solved within 20 seconds

    Scenario: Retrying and castling two squares keeps the failed result
      Given Alice has played a wrong move and retried
      When Alice castles by moving the king two squares
      Then Alice's puzzle is solved within 20 seconds
      And Alice's game log records that puzzle as failed
      And Alice's stats show 1 played, 0 solved, and 0% accuracy

    Scenario: Retrying and castling onto the rook keeps the failed result
      Given Alice has played a wrong move and retried
      When Alice castles by moving the king onto its own rook
      Then Alice's puzzle is solved within 20 seconds
      And Alice's game log records that puzzle as failed
      And Alice's stats show 1 played, 0 solved, and 0% accuracy
