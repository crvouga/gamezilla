@domain:chess-board
Feature: Change chessboard settings safely
  When a chessboard's activity changes, Alice wants its position and choices to
  take effect at once, so an unfinished gesture cannot change the new activity.

  Rule: Disabling interactivity cancels an unfinished move

    Scenario: An enabled chessboard accepts a legal move
      Given Alice has an interactive chessboard
      When Alice moves the piece from e2 to e4
      Then Alice sees a White pawn on e4
      And Alice's activity receives one move

    @regression:chessboard-pointer-authority
    Scenario: Disabling interactivity puts a held piece back
      Given Alice is dragging the piece on e2
      When Alice's board settings disable interactivity
      Then Alice no longer holds a piece
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    Scenario: A disabled chessboard refuses a move
      Given Alice has a chessboard with interactivity disabled
      When Alice moves the piece from e2 to e4
      Then Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

  Rule: A replacement position cancels an unfinished gesture
    No counter-example: replacing a position always abandons the old gesture.

    Scenario: A replacement position puts a held piece back
      Given Alice is dragging the piece on e2
      When Alice's activity replaces the position
      Then Alice no longer holds a piece
      And Alice sees the replacement position
      And Alice's activity receives no moves

    @regression:chessboard-equivalent-sync
    Scenario: Replacing the same position preserves selection
      Given Alice has selected the piece on e2
      When Alice's activity supplies the same position again
      Then Alice still has e2 selected
      And Alice's activity receives no moves

  Rule: Changing orientation cancels a drag without changing the position
    No counter-example: orientation never changes a chess position.

    Scenario: Turning a held chessboard puts the piece back
      Given Alice is dragging the piece on e2
      When Alice changes the orientation
      Then Alice no longer holds a piece
      And Alice sees the White pawn remaining on e2
      And Alice's chessboard faces Black

  Rule: Resizing preserves idle selection and cancels a drag
    No counter-example: resizing never makes a move.

    Scenario: A resized chessboard keeps its selected piece
      Given Alice has selected the piece on e2
      When Alice resizes the chessboard
      Then Alice still has e2 selected
      And Alice sees the White pawn remaining on e2

    Scenario: Resizing while holding a piece cancels the drag
      Given Alice is dragging the piece on e2
      When Alice resizes the chessboard
      Then Alice no longer holds a piece
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

  Rule: Abandoning a drag never moves a piece
    No counter-example: cancelling a gesture never offers a move to the activity.

    Scenario: Cancelling a held piece returns it to its square
      Given Alice is dragging the piece on e2
      When Alice cancels the drag
      Then Alice no longer holds a piece
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    @regression:chessboard-focus-interruption
    Scenario: Switching away from the activity cancels a held piece
      Given Alice is dragging the piece on e2
      When Alice switches away from the chessboard's activity
      Then Alice no longer holds a piece
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    Scenario: Cancelling without a held piece preserves the position
      Given Alice has an interactive chessboard
      When Alice cancels the drag
      Then Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves
