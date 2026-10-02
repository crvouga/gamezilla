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

    Scenario: Disabling interactivity abandons a pending promotion choice
      Given Alice has a pending White promotion from a7 to a8
      When Alice's board settings disable interactivity
      Then Alice sees the White pawn remaining on a7
      And Alice is not offered a promotion choice
      And Alice's activity receives no moves

    Scenario: Re-enabling interactivity allows a future promotion request
      Given Alice has a chessboard ready for White's promotion from a7 to a8 with interactivity disabled
      When Alice's board settings enable interactivity
      Then Alice can request promotion from a7 to a8
      And Alice sees the White pawn remaining on a7

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

    Scenario: A replacement position abandons a pending promotion choice
      Given Alice has a pending White promotion from a7 to a8
      When Alice's activity replaces the position
      Then Alice sees the replacement position
      And Alice is not offered a promotion choice
      And Alice's activity receives no moves

    Scenario: An unrelated position clears the old move and selection
      Given Alice has a chessboard after White's move from e2 to e4 with e7 selected
      When Alice's activity replaces the position
      Then Alice sees the replacement position
      And Alice sees no selection or legal destinations
      And Alice sees no last move marked
      And Alice hears no chessboard sounds

    Scenario: An unrelated position clears the earlier move announcement
      Given Alice has a chessboard after White checkmated Black by moving the queen from g6 to g7
      When Alice's activity replaces the position
      Then Alice sees the replacement position
      And Alice has no move announcement from the previous position

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

  Rule: The activity may confirm or refuse an offered move

    Scenario: Confirmation preserves the offered move without offering it twice
      Given Alice has a chessboard after offering White's move from e2 to e4
      When Alice's activity confirms the offered position
      Then Alice sees a White pawn on e4
      And Alice sees e2 and e4 marked as the last move
      And Alice hears no chessboard sounds
      And Alice's activity receives no moves

    Scenario: Refusal restores the earlier position without sound
      Given Alice has a chessboard after offering White's move from e2 to e4
      When Alice's activity refuses the offered move
      Then Alice sees White's offered move refused
      And Alice sees the White pawn remaining on e2
      And Alice hears no chessboard sounds
      And Alice's activity receives no moves

  Rule: Only usable supplied positions become the chessboard's position

    Scenario: An immediate opponent reply has one move highlight and sound
      Given Alice has a chessboard after offering White's move from e2 to e4
      When Alice's activity supplies Black's reply from e7 to e5
      Then Alice sees a Black pawn on e5
      And Alice sees e7 and e5 marked as the last move
      And Alice hears one move sound

    Scenario: An unusable supplied position keeps the last good position
      Given Alice has an interactive chessboard
      When Alice's activity supplies an unusable position
      Then Alice still sees the position before White's first move
      And Alice hears no chessboard sounds
      And Alice's activity receives no moves

    Scenario: An unusable initial position starts normal chess
      Given Alice's activity has no chessboard yet
      When Alice's activity starts a chessboard with an unusable position
      Then Alice sees the position before White's first move
      And Alice sees White to move

  Rule: Automatic queen promotion changes apply to the next request

    Scenario: A newly enabled automatic queen choice applies to a new request
      Given Alice has a chessboard ready for White's promotion from a7 to a8 with automatic queen promotion enabled
      When Alice moves the piece from a7 to a8
      Then Alice sees a White queen on a8
      And Alice's activity receives one move promoting to a queen

    Scenario: Enabling automatic queen promotion preserves a pending explicit choice
      Given Alice has a pending White promotion from a7 to a8
      When Alice's board settings enable automatic queen promotion
      Then Alice is still offered queen, rook, bishop and knight as the promotion choice
      And Alice cannot complete the move until the pending promotion choice is decided
      And Alice's activity receives no moves
