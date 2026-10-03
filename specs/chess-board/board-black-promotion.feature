@domain:chess-board
Feature: Complete Black's promotion in either orientation
  When Alice promotes a Black pawn, Alice wants the same four choices in
  either orientation, so the chosen move and any capture finish correctly.

  These positions have Black's king on g8 and pawn on a2, and White's king
  on g1 and knight on b1. All other squares are empty before the request.

  Rule: Black's last-rank request waits at source for a named choice

    Scenario Outline: A Black quiet move or capture waits for choice in either orientation
      Given Alice has a chessboard facing <side> with Black's pawn on a2 ready to promote and White's knight on b1
      When Alice moves the piece from a2 to <destination>
      Then Alice is offered queen, rook, bishop and knight as the promotion choice
      And Alice sees the Black pawn remaining on a2
      And Alice sees the White knight remaining on b1
      And Alice's activity receives no moves

      Examples:
        | side  | destination |
        | White | a1          |
        | Black | a1          |
        | White | b1          |
        | Black | b1          |

    Scenario: Disabled Black promotion cannot offer a choice
      Given Alice has a chessboard facing Black with Black's pawn on a2 ready to promote and interactivity disabled
      When Alice moves the piece from a2 to a1
      Then Alice cannot request promotion while interactivity is disabled
      And Alice is not offered a promotion choice
      And Alice sees the Black pawn remaining on a2
      And Alice's activity receives no moves

  Rule: Each quiet Black choice completes one promotion and preserves the opposing knight
    No counter-example: a legal pending quiet promotion always completes with its chosen piece.

    Scenario Outline: Every Black quiet choice completes on a White-facing board
      Given Alice has a chessboard facing White with Black's promotion from a2 to a1 pending and White's knight on b1
      When Alice chooses the promotion to a <piece>
      Then Alice sees a Black <piece> on a1
      And Alice sees the White knight remaining on b1
      And Alice's chessboard faces White
      And Alice's activity receives one move promoting to a <piece>

      Examples:
        | piece  |
        | queen  |
        | rook   |
        | bishop |
        | knight |

    Scenario Outline: Every Black quiet choice completes on a Black-facing board
      Given Alice has a chessboard facing Black with Black's promotion from a2 to a1 pending and White's knight on b1
      When Alice chooses the promotion to a <piece>
      Then Alice sees a Black <piece> on a1
      And Alice sees the White knight remaining on b1
      And Alice's chessboard faces Black
      And Alice's activity receives one move promoting to a <piece>

      Examples:
        | piece  |
        | queen  |
        | rook   |
        | bishop |
        | knight |

  Rule: Each Black capture choice removes its victim and completes one promotion
    No counter-example: a legal pending capture-promotion always removes the captured piece.

    Scenario Outline: Every Black capture choice completes on a White-facing board
      Given Alice has a chessboard facing White with Black's capture-promotion from a2 to b1 pending against White's knight
      When Alice chooses the promotion to a <piece>
      Then Alice sees a Black <piece> on b1
      And Alice sees no White knight on b1
      And Alice's chessboard faces White
      And Alice's activity receives one capture move promoting to a <piece>

      Examples:
        | piece  |
        | queen  |
        | rook   |
        | bishop |
        | knight |

    Scenario Outline: Every Black capture choice completes on a Black-facing board
      Given Alice has a chessboard facing Black with Black's capture-promotion from a2 to b1 pending against White's knight
      When Alice chooses the promotion to a <piece>
      Then Alice sees a Black <piece> on b1
      And Alice sees no White knight on b1
      And Alice's chessboard faces Black
      And Alice's activity receives one capture move promoting to a <piece>

      Examples:
        | piece  |
        | queen  |
        | rook   |
        | bishop |
        | knight |

  Rule: A promotion reaching a dead position announces the draw with one end sound

    @regression:chessboard-draw-announcement
    Scenario Outline: Capturing the last opposing piece into dead material announces a draw
      Given Alice has a chessboard facing Black with Black's capture-promotion from a2 to b1 pending against White's knight
      When Alice chooses the promotion to a <piece>
      Then Alice's move announcement identifies a drawn position
      And Alice hears one end sound after capture and promotion feedback
      And Alice's activity receives one capture move promoting to a <piece>

      Examples:
        | piece  |
        | bishop |
        | knight |

    Scenario Outline: Keeping the opposing knight does not announce a dead-position draw
      Given Alice has a chessboard facing Black with Black's promotion from a2 to a1 pending and White's knight on b1
      When Alice chooses the promotion to a <piece>
      Then Alice is not told a dead-position draw because the position still permits checkmate
      And Alice hears no end sound
      And Alice sees the White knight remaining on b1

      Examples:
        | piece  |
        | bishop |
        | knight |
