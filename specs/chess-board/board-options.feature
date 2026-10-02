@domain:chess-board
Feature: Choose the chessboard's appearance
  When Alice's activity presents a chessboard, Alice wants its appearance choices
  respected, so size and markings explain the same position.

  Rule: The chessboard uses the activity's chosen width and offers moves only at a supported width

    Scenario: Available space determines width when no fixed width is chosen
      Given Alice has a chessboard without a fixed width
      When Alice's activity narrows the available space
      Then Alice's chessboard fills the available width
      And Alice's chessboard has equal width and height

    Scenario: A fixed width takes precedence over changing available space
      Given Alice has a chessboard with the activity's fixed width
      When Alice's activity narrows the available space
      Then Alice's chessboard still has the activity's fixed width
      And Alice's chessboard has equal width and height

    Scenario: Choosing a fixed width takes effect on an existing chessboard
      Given Alice has a chessboard without a fixed width
      When Alice's activity chooses a fixed width
      Then Alice's chessboard has the activity's fixed width
      And Alice's chessboard has equal width and height

    Scenario: Removing a fixed width restores the available width
      Given Alice has a chessboard with the activity's fixed width
      When Alice's activity removes the fixed width
      Then Alice's chessboard fills the available width
      And Alice's chessboard has equal width and height

    Scenario: The smallest supported width offers a legal move
      Given Alice has an interactive chessboard 196 pixels wide
      When Alice moves the piece from e2 to e4
      Then Alice sees a White pawn on e4
      And Alice's activity receives one move

    Scenario: A supported width permits holding a piece before its destination is chosen
      Given Alice has an interactive chessboard 196 pixels wide
      When Alice begins dragging the piece on e2
      Then Alice holds the piece from e2
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    Scenario: Holding another piece clears the earlier selection before a move
      Given Alice has selected the piece on e2
      When Alice begins dragging the piece on d2
      Then Alice holds the piece from d2
      And Alice sees no selection
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    Scenario: The largest supported width offers a legal move
      Given Alice has an interactive chessboard 16384 pixels wide
      When Alice moves the piece from e2 to e4
      Then Alice sees a White pawn on e4
      And Alice's activity receives one move

    @regression:chessboard-preview-input
    Scenario: A narrow preview refuses a move while retaining the position
      Given Alice has a chessboard 195 pixels wide
      When Alice moves the piece from e2 to e4
      Then Alice cannot move a piece while the chessboard is a preview
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    @regression:chessboard-preview-input
    Scenario: A narrow preview also refuses keyboard moves
      Given Alice has a chessboard 195 pixels wide
      When Alice moves the piece from e2 to e4 with the keyboard
      Then Alice cannot move a piece while the chessboard is a preview
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    Scenario: A preview refuses selecting a piece
      Given Alice has a chessboard 195 pixels wide
      When Alice selects the piece on e2
      Then Alice cannot select a piece while the chessboard is a preview
      And Alice sees no selection or legal destinations
      And Alice's activity receives no moves

    Scenario: A preview refuses holding a piece
      Given Alice has a chessboard 195 pixels wide
      When Alice begins dragging the piece on e2
      Then Alice cannot hold a piece while the chessboard is a preview
      And Alice no longer holds a piece
      And Alice's activity receives no moves

    Scenario: Activity-disabled input still refuses a move at a supported width
      Given Alice has a chessboard 196 pixels wide with interactivity disabled
      When Alice moves the piece from e2 to e4
      Then Alice cannot move a piece while interactivity is disabled
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    Scenario: Activity-disabled input refuses selection at a supported width
      Given Alice has a chessboard 196 pixels wide with interactivity disabled
      When Alice selects the piece on e2
      Then Alice cannot select a piece while interactivity is disabled
      And Alice sees no selection or legal destinations
      And Alice's activity receives no moves

    Scenario: Activity-disabled input refuses holding at a supported width
      Given Alice has a chessboard 196 pixels wide with interactivity disabled
      When Alice begins dragging the piece on e2
      Then Alice cannot hold a piece while interactivity is disabled
      And Alice no longer holds a piece
      And Alice's activity receives no moves

    @regression:chessboard-preview-input
    Scenario: A preview cannot begin a promotion choice
      Given Alice has a chessboard ready for White's promotion from a7 to a8
      And Alice has a chessboard 195 pixels wide
      When Alice moves the piece from a7 to a8
      Then Alice cannot move a piece while the chessboard is a preview
      And Alice is not offered a promotion choice
      And Alice sees the White pawn remaining on a7
      And Alice's activity receives no moves

    @regression:chessboard-preview-input
    Scenario: A width beyond the supported range remains a preview
      Given Alice has a chessboard 16385 pixels wide
      When Alice moves the piece from e2 to e4
      Then Alice cannot move a piece while the chessboard is a preview
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    Scenario: A fixed preview width wins over wider available space
      Given Alice has selected the piece on e2 with a fixed width and enough available space to move
      When Alice's activity chooses a fixed width of 195 pixels
      Then Alice cannot move a piece while the chessboard is a preview
      And Alice sees no selection or legal destinations
      And Alice's chessboard has the activity's fixed width
      And Alice's activity receives no moves

    Scenario: Removing a fixed preview width restores playable available space
      Given Alice has a chessboard with a fixed width of 195 pixels and enough available space to move
      When Alice's activity removes the fixed width
      Then Alice's chessboard fills the available width
      And Alice can select the piece on e2
      And Alice sees no selection or legal destinations

    Scenario: Resizing within the supported range preserves a pending promotion
      Given Alice has a pending White promotion from a7 to a8
      When Alice resizes the chessboard
      Then Alice is still offered queen, rook, bishop and knight as the promotion choice
      And Alice sees the White pawn remaining on a7
      And Alice's activity receives no moves

    @regression:chessboard-preview-input
    Scenario: Resizing into a preview abandons selection
      Given Alice has selected the piece on e2
      When Alice's activity narrows the chessboard to 195 pixels wide
      Then Alice sees no selection or legal destinations
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    Scenario: Resizing into a preview puts down a held piece
      Given Alice is dragging the piece on e2
      When Alice's activity narrows the chessboard to 195 pixels wide
      Then Alice no longer holds a piece
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    @regression:chessboard-preview-input
    Scenario: Resizing into a preview abandons a pending promotion
      Given Alice has a pending White promotion from a7 to a8
      When Alice's activity narrows the chessboard to 195 pixels wide
      Then Alice is not offered a promotion choice
      And Alice sees the White pawn remaining on a7
      And Alice's activity receives no moves

    Scenario: Returning to a supported width permits a fresh choice
      Given Alice has a chessboard 195 pixels wide after its selection was abandoned
      When Alice's activity widens the chessboard to 196 pixels wide
      Then Alice can select the piece on e2
      And Alice sees no selection or legal destinations
      And Alice sees the White pawn remaining on e2

  Rule: Coordinate visibility follows the activity's choice in either orientation

    Scenario: Shown coordinates name all eight files and ranks
      Given Alice has a chessboard with coordinates hidden
      When Alice's board settings show coordinates
      Then Alice sees coordinates for all eight files and all eight ranks
      And Alice sees the White pawn remaining on e2

    Scenario: Hidden coordinates stay hidden when orientation changes
      Given Alice has a chessboard with coordinates hidden
      When Alice changes the orientation
      Then Alice still sees no coordinates
      And Alice's chessboard faces Black
      And Alice sees the White pawn remaining on e2

    Scenario: Hiding coordinates preserves a held piece
      Given Alice is dragging the piece on e2
      When Alice's board settings hide coordinates
      Then Alice sees no coordinates
      And Alice still holds the piece from e2

  Rule: Legal destination marks may be hidden without changing selection or legality

    Scenario: Hidden legal marks preserve the meaning of a selection
      Given Alice has selected the piece on e2
      When Alice's board settings hide legal destination marks
      Then Alice still has e2 selected
      And Alice cannot see legal destination marks while they are hidden
      And Alice can identify e4 as a legal destination without sound

    Scenario: Showing legal marks restores the selected piece's destinations
      Given Alice has selected the piece on e2 with legal destination marks hidden
      When Alice's board settings show legal destination marks
      Then Alice has e2 selected
      And Alice sees only e3 and e4 as legal destinations

    Scenario: Hiding legal marks preserves a pending promotion choice
      Given Alice has a pending White promotion from a7 to a8
      When Alice's board settings hide legal destination marks
      Then Alice is still offered queen, rook, bishop and knight as the promotion choice
      And Alice's activity receives no moves

  Rule: Last move marks may be hidden without changing the position

    Scenario: Hiding the last move keeps its piece at the destination
      Given Alice has a chessboard after White's move from e2 to e4
      When Alice's board settings hide last move marks
      Then Alice cannot see last move marks while they are hidden
      And Alice sees a White pawn on e4

    Scenario: Showing the last move restores its source and destination marks
      Given Alice has a chessboard after White's move from e2 to e4 with last move marks hidden
      When Alice's board settings show last move marks
      Then Alice sees e2 and e4 marked as the last move
      And Alice sees a White pawn on e4

  Rule: Board color choices preserve the position and unfinished choices
    No counter-example: changing colors never makes or cancels a chess move.

    Scenario: Chosen square colors take effect without moving a piece
      Given Alice has selected the piece on e2
      When Alice's activity chooses green and cream board colors
      Then Alice sees green and cream squares
      And Alice still has e2 selected
      And Alice sees the White pawn remaining on e2

    Scenario: Changing colors preserves a held piece
      Given Alice is dragging the piece on e2
      When Alice's activity chooses green and cream board colors
      Then Alice sees green and cream squares
      And Alice still holds the piece from e2

    Scenario: Changing colors preserves a pending promotion choice
      Given Alice has a pending White promotion from a7 to a8
      When Alice's activity chooses green and cream board colors
      Then Alice sees green and cream squares
      And Alice is still offered queen, rook, bishop and knight as the promotion choice

    Scenario: Restoring the earlier colors preserves selection and position
      Given Alice has selected the piece on e2 with green and cream board colors
      When Alice's activity chooses brown and cream board colors
      Then Alice sees brown and cream squares
      And Alice still has e2 selected
      And Alice sees the White pawn remaining on e2
