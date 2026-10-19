@domain:chess
Feature: A chess puzzle's review in algebraic notation
  When a solver reviews a chess puzzle they played, they want its moves
  written in algebraic notation, so they can read and share the line as chess
  players write it.

  The puzzle here is a mate in two whose line is four moves long: Kh4 g5+
  Kg3 Rg2#.

  Rule: A chess puzzle's review lists its moves in algebraic notation
    No counter-example: every move of a chess puzzle's line is written the same way; opening, stepping and jumping through a review is every game's.

    Scenario: The review lists the moves in algebraic notation
      Given Alice is signed in
      And Alice is solving the four-move mate-in-two puzzle
      And Alice has solved the puzzle
      When Alice opens the puzzle's review from their game log
      Then Alice's review lists the moves "Kh4, g5+, Kg3, Rg2#"
