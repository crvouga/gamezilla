@domain:chess
Feature: Where a chess piece can go
  When a solver picks up a piece in a chess puzzle, they want to see where it
  can go, so they choose among legal moves only. Who may move and when is
  every game's.

  Rule: Picking up a piece shows every square it can legally reach
    No counter-example: a piece shows where it can go whenever it may be moved; when no move can be made is every game's.

    Scenario: Picking up a piece shows where it can go
      Given Alice is signed in
      And Alice is solving the two-rook clearance puzzle
      When Alice picks up the rook on a1
      Then Alice's board shows the rook on a1 can go to a2, a3, a4, a5, a6, b1, c1 and d1
