@domain:chess-board
Feature: Open a fresh chessboard for the activity
  When an activity presents a chessboard, Alice wants its starting position
  and keyboard entry clear, so earlier choices do not belong to a new board.

  Rule: A chessboard without a supplied position starts normal chess
    No counter-example: the default position is always the normal opening.

    Scenario Outline: Either orientation starts with the normal opening
      Given Alice's activity has no chessboard yet
      When Alice's activity starts a chessboard facing <side>
      Then Alice sees the position before White's first move
      And Alice sees White to move
      And Alice's chessboard faces <side>

      Examples:
        | side  |
        | White |
        | Black |

    Scenario: A fresh chessboard has no selection or annotations
      Given Alice's activity has no chessboard yet
      When Alice's activity starts a chessboard facing White
      Then Alice sees no selection or legal destinations
      And Alice sees no last move marked
      And Alice sees no personal annotations
      And Alice sees no activity annotations

  Rule: Opening prepares the facing corner for keyboard entry without taking another control's keyboard

    Scenario Outline: The first keyboard square follows orientation
      Given Alice's activity has no chessboard yet
      When Alice's activity starts a chessboard facing <side>
      Then Alice's first keyboard square is <square>

      Examples:
        | side  | square |
        | White | a1     |
        | Black | h8     |

    Scenario: Opening preserves the keyboard on another activity's control
      Given Alice's keyboard is on another activity's control
      And Alice's activity has no chessboard yet
      When Alice's activity starts a chessboard facing White
      Then Alice cannot have her keyboard taken from the other activity's control by opening the chessboard

  Rule: Reopening uses the activity's position and abandons the closed board's choices
    No counter-example: a new board has no old selection or local move marks.

    Scenario: Reopening the original position forgets an unconfirmed move and selection
      Given Alice's activity has closed its chessboard after the unconfirmed move from e2 to e4 with e7 selected
      When Alice's activity starts a chessboard facing White
      Then Alice sees the position before White's first move
      And Alice sees no selection or legal destinations
      And Alice sees no last move marked
      And Alice's activity receives no moves
