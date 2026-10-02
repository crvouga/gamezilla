@domain:chess-board
Feature: Understand the chessboard without sound
  When Alice uses a keyboard or cannot hear the chessboard, Alice wants pieces
  and selections described, so choosing a move does not depend on sound.

  Rule: Each square communicates its piece and selection
    No counter-example: every square has an identity, including empty squares.

    @regression:chessboard-square-a11y
    Scenario: A selected piece communicates its destinations
      Given Alice has an interactive chessboard
      When Alice selects the piece on e2
      Then Alice can identify the White pawn on e2 without sound
      And Alice can identify e2 as selected without sound
      And Alice can identify e4 as a legal destination without sound

    Scenario: Empty squares communicate their identity
      Given Alice has an interactive chessboard
      When Alice selects the piece on g1
      Then Alice can identify e4 as empty without sound

  Rule: Keyboard moves follow the same legality as other moves

    Scenario: A legal keyboard move offers one move
      Given Alice has an interactive chessboard
      When Alice moves the piece from e2 to e4 with the keyboard
      Then Alice sees a White pawn on e4
      And Alice's activity receives one move

    Scenario: An illegal keyboard destination does not move the piece
      Given Alice has an interactive chessboard
      When Alice moves the piece from e2 to e5 with the keyboard
      Then Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves
