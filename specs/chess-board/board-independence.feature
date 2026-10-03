@domain:chess-board
Feature: Use separate chessboards independently
  When Alice has two chessboards, Alice wants each activity's position and
  choices kept separate, so using one board cannot change the other.

  Rule: A move, selection or held piece belongs only to its chosen chessboard
    No counter-example: each chessboard keeps its own pieces and activity offers.

    Scenario: Moving on the first board preserves the second board's selection
      Given Alice has two separate interactive chessboards
      And Alice has e2 selected on the second chessboard
      When Alice moves the piece from e2 to e4 on the first chessboard
      Then Alice sees a White pawn on e4 on the first chessboard
      And Alice still has e2 selected on the second chessboard
      And Alice's first activity receives one move while the second activity receives no moves

    Scenario: Selecting on the first board keeps the second board's selection
      Given Alice has two separate interactive chessboards
      And Alice has e2 selected on the second chessboard
      When Alice selects the piece on e2 on the first chessboard
      Then Alice sees e2 selected on both chessboards
      And Alice's two activities receive no moves

    Scenario: Holding on the first board keeps the second board's selected piece at source
      Given Alice has two separate interactive chessboards
      And Alice has e2 selected on the second chessboard
      When Alice begins dragging the piece on e2 on the first chessboard
      Then Alice holds the piece from e2 on the first chessboard
      And Alice still has e2 selected on the second chessboard
      And Alice sees the White pawn remaining on e2 on the second chessboard
      And Alice's two activities receive no moves

    Scenario: Cancelling one held piece preserves the other board's selection
      Given Alice holds e2 on the first chessboard and has e2 selected on the second
      When Alice cancels the drag on the first chessboard
      Then Alice no longer holds a piece on the first chessboard
      And Alice still has e2 selected on the second chessboard
      And Alice's two activities receive no moves

    Scenario: Replacing one activity's position preserves the other activity's board
      Given Alice has two separate interactive chessboards
      And Alice has e2 selected on the second chessboard
      When Alice's first activity replaces its chessboard's position
      Then Alice sees the replacement position on the first chessboard
      And Alice sees the position before White's first move on the second chessboard
      And Alice still has e2 selected on the second chessboard
      And Alice's two activities receive no moves

  Rule: Each activity chooses only its own board's input and sound

    Scenario: Disabling the first board clears only its selected piece
      Given Alice has e2 selected on both chessboards
      When Alice's first board settings disable interactivity
      Then Alice sees no selection on the first chessboard
      And Alice still has e2 selected on the second chessboard
      And Alice's two activities receive no moves

    Scenario: Enabling the first board preserves the second board's choice
      Given Alice has a disabled first chessboard and e2 selected on the second chessboard
      When Alice's first board settings enable interactivity
      Then Alice can move a piece on the first chessboard
      And Alice still has e2 selected on the second chessboard

    Scenario: A disabled first board cannot offer a move or disturb the second board
      Given Alice has a disabled first chessboard and e2 selected on the second chessboard
      When Alice moves the piece from e2 to e4 on the first chessboard
      Then Alice cannot move a piece on the first chessboard while interactivity is disabled
      And Alice sees the White pawn remaining on e2 on the first chessboard
      And Alice still has e2 selected on the second chessboard
      And Alice's two activities receive no moves

    Scenario: Disabling one board's sound preserves the other board's sound choice
      Given Alice has two separate interactive chessboards
      When Alice's first board settings disable sound
      Then Alice's first chessboard has sound disabled
      And Alice's second chessboard has sound enabled
      And Alice's two activities receive no moves

    Scenario: Re-enabling the first board's sound preserves the second board's sound choice
      Given Alice has a silent first chessboard and a second chessboard with sound enabled
      When Alice's first board settings enable sound
      Then Alice's first chessboard has sound enabled
      And Alice's second chessboard has sound enabled
      And Alice's two activities receive no moves

    Scenario: The second board still sounds after the first board is silenced
      Given Alice has a silent first chessboard and a second chessboard with sound enabled
      When Alice moves the piece from e2 to e4 on the second chessboard
      Then Alice hears one move sound from the second chessboard
      And Alice hears no sound from the first chessboard
      And Alice's second activity receives one move while the first activity receives no moves

    Scenario: A silent first board moves without borrowing the second board's sound
      Given Alice has a silent first chessboard and a second chessboard with sound enabled
      When Alice moves the piece from e2 to e4 on the first chessboard
      Then Alice cannot hear chessboard sounds from the first board while its sound is disabled
      And Alice's second chessboard has sound enabled
      And Alice's first activity receives one move while the second activity receives no moves

  Rule: Closing one board preserves the other board's current activity
    No counter-example: closing a chessboard affects only that chessboard.

    Scenario: Closing the first board keeps the second board selected and available
      Given Alice has two separate interactive chessboards
      And Alice has e2 selected on the second chessboard
      When Alice closes the first chessboard
      Then Alice cannot see the first chessboard because it is closed
      And Alice still has e2 selected on the second chessboard
      And Alice's second chessboard has sound enabled
      And Alice's two activities receive no moves

    Scenario: The second board still makes and sounds a move after the first board closes
      Given Alice has closed the first chessboard while the second chessboard remains interactive
      When Alice moves the piece from e2 to e4 on the second chessboard
      Then Alice sees a White pawn on e4 on the second chessboard
      And Alice hears one move sound from the second chessboard
      And Alice's second activity receives one move while the first activity receives no moves
