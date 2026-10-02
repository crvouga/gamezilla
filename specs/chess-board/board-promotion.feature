@domain:chess-board
Feature: Decide promotion with the keyboard
  When Alice requests a pawn's promotion, Alice wants named choices and the
  keyboard in the right place, so deciding or cancelling lets play continue.

  Rule: A promotion request names all four choices and gives the queen the keyboard

    @regression:chessboard-promotion-focus
    Scenario: A requested promotion names each piece and gives the queen the keyboard
      Given Alice has a chessboard ready for White's promotion from a7 to a8
      When Alice moves the piece from a7 to a8
      Then Alice can identify queen, rook, bishop and knight as the promotion choices without sound
      And Alice's keyboard is on the queen promotion choice
      And Alice sees the White pawn remaining on a7

    Scenario: Disabled input cannot request a promotion choice
      Given Alice has a chessboard ready for White's promotion from a7 to a8 with interactivity disabled
      When Alice moves the piece from a7 to a8
      Then Alice cannot request promotion while interactivity is disabled
      And Alice is not offered a promotion choice
      And Alice sees the White pawn remaining on a7
      And Alice's activity receives no moves

  Rule: Deciding or cancelling promotion gives the keyboard back to the board

    @regression:chessboard-promotion-focus
    Scenario: A chosen promotion gives its destination the keyboard
      Given Alice has a pending White promotion from a7 to a8
      When Alice chooses the promotion to a queen
      Then Alice's keyboard is on a8
      And Alice sees a White queen on a8
      And Alice's activity receives one move promoting to a queen

    @regression:chessboard-promotion-focus
    Scenario: A cancelled promotion gives its source the keyboard
      Given Alice has a pending White promotion from a7 to a8
      When Alice cancels the promotion
      Then Alice's keyboard is on a7
      And Alice sees the White pawn remaining on a7
      And Alice's activity receives no moves

    Scenario: A piece cannot be chosen without a pending promotion
      Given Alice has a chessboard ready for White's promotion from a7 to a8
      When Alice chooses the promotion to a queen
      Then Alice cannot choose a promotion without a pending move
      And Alice sees the White pawn remaining on a7
      And Alice's activity receives no moves
