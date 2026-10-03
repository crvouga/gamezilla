@domain:chess-board
Feature: Recognize the activity's annotation appearance
  When an activity explains a position, Alice wants its chosen colors and
  square marks recognizable, so their meaning stays on the assigned squares.

  Rule: Activity arrows use the primary color unless the activity chooses another appearance
    No counter-example: an activity arrow always retains its chosen appearance.

    Scenario: An arrow without a chosen color uses the activity's primary green
      Given Alice has an interactive chessboard
      When Alice's activity supplies an arrow from e2 to e4 with its default appearance
      Then Alice sees a green solid arrow from e2 to e4
      And Alice's activity receives no moves

    Scenario Outline: Chosen colors and dashed lines retain their appearance
      Given Alice has an interactive chessboard
      When Alice's activity supplies an arrow from e2 to e4 with <appearance> appearance
      Then Alice sees a <color> <line> arrow from e2 to e4
      And Alice's activity receives no moves

      Examples:
        | appearance          | color        | line   |
        | danger              | red          | solid  |
        | bright green        | bright green | solid  |
        | bright green dashed | bright green | dashed |

  Rule: Feedback badges use their usual symbols and colors unless the activity chooses another appearance
    No counter-example: the activity owns each feedback badge's appearance.

    Scenario: Usual feedback marks keep their symbols, colors and upper-right placement
      Given Alice has an interactive chessboard
      When Alice's activity supplies the usual feedback badges
      Then Alice sees a green tick at the upper-right of e4
      And Alice sees a red cross at the upper-right of d5
      And Alice sees two blue exclamation marks at the upper-right of f3

    Scenario: The activity may place a feedback mark in the center
      Given Alice has an interactive chessboard
      When Alice's activity supplies a centered tick on e4
      Then Alice sees a green tick at the center of e4

    Scenario: The activity may choose another feedback color
      Given Alice has an interactive chessboard
      When Alice's activity supplies a gold tick on e4
      Then Alice sees a gold tick at the upper-right of e4

  Rule: Turning the chessboard keeps feedback on its assigned logical square
    No counter-example: turning never assigns a mark to a different square.

    Scenario: A centered feedback mark stays on e4 when the board turns
      Given Alice has a centered green tick on e4
      When Alice changes the orientation
      Then Alice sees a green tick at the center of e4
      And Alice's chessboard faces Black
