@domain:chess-board
Feature: Explain positions with chessboard annotations
  When Alice considers a chess position, Alice wants arrows and square marks
  kept separate from moves, so an annotation never changes the position.

  Rule: Capture destinations have rings and quiet destinations have dots

    Scenario: A selected pawn distinguishes capture from an empty destination
      Given Alice has a chessboard ready for a capture
      When Alice selects the piece on e4
      Then Alice sees a capture ring on d5
      And Alice sees a quiet destination dot on e5

    @regression:chessboard-en-passant-hint
    Scenario: An en passant destination offers a capture ring before the move
      Given Alice has a chessboard ready for White to capture en passant from e5 to d6
      When Alice selects the piece on e5
      Then Alice sees a capture ring on d6
      And Alice sees a quiet destination dot on e6

    Scenario: An empty destination is not offered as a capture
      Given Alice has an interactive chessboard
      When Alice selects the piece on e2
      Then Alice is not offered a capture ring on e4 because e4 is empty
      And Alice sees a quiet destination dot on e4

  Rule: Activity annotations retain their chosen appearance until the activity removes them
    No counter-example: personal annotations and chess moves never remove activity annotations.

    Scenario: Activity arrows retain their chosen colors and line styles
      Given Alice has an interactive chessboard
      When Alice's activity supplies colored arrows
      Then Alice sees a green solid arrow from e2 to e4
      And Alice sees a blue dashed arrow from a1 to a8
      And Alice's activity receives no moves

    @regression:chessboard-named-feedback
    Scenario: Activity square marks stay on their assigned squares
      Given Alice has an interactive chessboard
      When Alice's activity supplies square annotations
      Then Alice sees a blue fill on d5
      And Alice sees a gold ring on e4
      And Alice sees the badge named "Plan" on f3

    Scenario: Choosing a piece removes personal marks while preserving activity marks
      Given Alice has personal arrows and circles alongside activity annotations
      When Alice selects the piece on e2
      Then Alice sees no personal annotations
      And Alice sees the activity's arrows and square annotations
      And Alice's activity receives no moves

    Scenario: Removing activity annotations clears only those annotations
      Given Alice has personal arrows and circles alongside activity annotations
      When Alice's activity removes its annotations
      Then Alice sees no activity annotations
      And Alice still sees the personal arrow from e2 to e4 and circle on d5

  Rule: Enabled personal annotations toggle without moving a piece

    Scenario: A completed personal arrow offers only arrows to the activity
      Given Alice is drawing a personal arrow from e2 to e4
      When Alice finishes drawing the personal arrow
      Then Alice sees a personal arrow from e2 to e4
      And Alice's activity receives the personal arrow from e2 to e4 without square annotations
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    Scenario: Drawing an existing personal arrow removes it
      Given Alice has a personal arrow from e2 to e4
      When Alice draws a personal arrow from e2 to e4
      Then Alice sees no personal arrow from e2 to e4
      And Alice's activity receives an empty set of personal arrows
      And Alice's activity receives no moves

    Scenario: Marking a square adds a personal circle
      Given Alice has a chessboard with personal annotations enabled
      When Alice marks e4 with a personal circle
      Then Alice sees a personal circle on e4
      And Alice's activity receives an empty set of personal arrows
      And Alice sees the White pawn remaining on e2
      And Alice's activity receives no moves

    Scenario: Marking an existing personal circle removes it
      Given Alice has a personal circle on e4
      When Alice marks e4 with a personal circle
      Then Alice sees no personal circle on e4
      And Alice's activity receives an empty set of personal arrows
      And Alice's activity receives no moves

    Scenario: A circle change announces existing arrows without circle endpoints
      Given Alice has a personal arrow from e2 to e4 and circle on d5
      When Alice marks d5 with a personal circle
      Then Alice sees no personal circle on d5
      And Alice's activity receives the personal arrow from e2 to e4 without square annotations
      And Alice's activity receives no moves

    Scenario: Disabled personal annotations refuse an arrow
      Given Alice has a chessboard with personal annotations disabled
      When Alice draws a personal arrow from e2 to e4
      Then Alice cannot add a personal annotation while they are disabled
      And Alice sees no personal annotations
      And Alice's activity receives no moves

    Scenario: Disabled personal annotations refuse a circle
      Given Alice has a chessboard with personal annotations disabled
      When Alice marks e4 with a personal circle
      Then Alice cannot add a personal annotation while they are disabled
      And Alice sees no personal annotations
      And Alice's activity receives no moves

  Rule: Abandoned annotation drawing offers no completed annotation

    Scenario: Beginning an arrow shows its unfinished drawing
      Given Alice has a chessboard with personal annotations enabled
      When Alice begins drawing a personal arrow from e2 to e4
      Then Alice sees an unfinished personal arrow from e2 to e4
      And Alice's activity receives no annotation changes

    Scenario: Cancelling an unfinished arrow refuses its completion
      Given Alice is drawing a personal arrow from e2 to e4
      When Alice cancels the personal arrow
      Then Alice is not offered a completed personal arrow
      And Alice sees no unfinished personal arrow
      And Alice's activity receives no annotation changes

    Scenario: Disabling annotations cancels an unfinished arrow
      Given Alice is drawing a personal arrow from e2 to e4
      When Alice's board settings disable personal annotations
      Then Alice sees no unfinished personal arrow
      And Alice's activity receives no annotation changes

    Scenario: Re-enabling annotations permits the next drawing
      Given Alice has a chessboard with personal annotations disabled
      When Alice's board settings enable personal annotations
      Then Alice can draw a personal arrow
      And Alice's activity receives no annotation changes

    Scenario: Replacing the position abandons only the unfinished drawing
      Given Alice is drawing a personal arrow alongside activity annotations
      When Alice's activity replaces the position
      Then Alice sees no unfinished personal arrow
      And Alice sees the replacement position
      And Alice sees the activity's arrows and square annotations
      And Alice's activity receives no annotation changes

  Rule: Orientation changes keep completed annotations on the same logical squares
    No counter-example: an annotation belongs to named squares rather than an orientation.

    Scenario: Turning the chessboard preserves personal and activity annotations
      Given Alice has personal arrows and circles alongside activity annotations
      When Alice changes the orientation
      Then Alice still sees the personal arrow from e2 to e4 and circle on d5
      And Alice sees the activity's arrows and square annotations
      And Alice's chessboard faces Black

    Scenario: Turning the chessboard abandons an unfinished arrow
      Given Alice is drawing a personal arrow from e2 to e4
      When Alice changes the orientation
      Then Alice sees no unfinished personal arrow
      And Alice's chessboard faces Black
      And Alice's activity receives no annotation changes

    Scenario: Turning back preserves the same personal and activity annotations
      Given Alice has personal arrows and circles alongside activity annotations on a chessboard facing Black
      When Alice changes the orientation
      Then Alice still sees the personal arrow from e2 to e4 and circle on d5
      And Alice sees the activity's arrows and square annotations
      And Alice's chessboard faces White
