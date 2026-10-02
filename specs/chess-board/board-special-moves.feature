@domain:chess-board
Feature: Complete special chess moves
  When Alice reaches a special chess move, Alice wants the whole move to finish
  together, so the activity receives one move with the intended pieces.

  Rule: Legal castling moves the king and rook together

    Scenario Outline: Each castling direction completes both pieces for either side
      Given Alice has a chessboard ready for <side> <direction> castling
      When Alice moves the piece from <source> to <destination>
      Then Alice sees <side> castled <direction> with the king on <destination> and rook on <rook-destination>
      And Alice is told <side> castled <direction>
      And Alice hears one castle sound
      And Alice's activity receives one move

      Examples:
        | side  | direction | source | destination | rook-destination |
        | White | kingside  | e1     | g1          | f1               |
        | White | queenside | e1     | c1          | d1               |
        | Black | kingside  | e8     | g8          | f8               |
        | Black | queenside | e8     | c8          | d8               |

    Scenario Outline: Dropping the king on its own rook completes castling
      Given Alice has a chessboard ready for <side> <direction> castling
      When Alice drags the piece from <source> to <rook-source>
      Then Alice sees <side> castled <direction> with the king on <destination> and rook on <rook-destination>
      And Alice's activity receives one move

      Examples:
        | side  | direction | source | rook-source | destination | rook-destination |
        | White | kingside  | e1     | h1          | g1          | f1               |
        | Black | queenside | e8     | a8          | c8          | d8               |

    Scenario: Castling across check keeps both pieces in place
      Given Alice has a chessboard where White's kingside castling crosses check
      When Alice moves the piece from e1 to g1
      Then Alice cannot castle kingside across check
      And Alice sees the White king remaining on e1
      And Alice sees the White rook remaining on h1
      And Alice hears no castle sound
      And Alice's activity receives no moves

    Scenario Outline: Dragging the king to its castling destination completes both White pieces
      Given Alice has a chessboard ready for White <direction> castling
      When Alice drags the piece from e1 to <destination>
      Then Alice sees White castled <direction> with the king on <destination> and rook on <rook-destination>
      And Alice is told White castled <direction>
      And Alice hears one castle sound
      And Alice's activity receives one move

      Examples:
        | direction | destination | rook-destination |
        | kingside  | g1          | f1               |
        | queenside | c1          | d1               |

    Scenario: Silent castling completes both pieces without sound
      Given Alice has a silent chessboard ready for White kingside castling
      When Alice moves the piece from e1 to g1
      Then Alice sees White castled kingside with the king on g1 and rook on f1
      And Alice hears no chessboard sounds

  Rule: En passant removes the passed pawn and marks the completed move's source and destination

    Scenario: An en passant capture removes the pawn from its own square
      Given Alice has a chessboard ready for White to capture en passant from e5 to d6
      When Alice moves the piece from e5 to d6
      Then Alice sees a White pawn on d6
      And Alice sees no Black pawn on d5
      And Alice sees e5 and d6 marked as the last move
      And Alice hears one capture sound
      And Alice's activity receives one capture move

    Scenario: An expired en passant opportunity cannot remove either pawn
      Given Alice has a chessboard where White's en passant opportunity from e5 to d6 has expired
      When Alice moves the piece from e5 to d6
      Then Alice cannot capture en passant after its opportunity has expired
      And Alice sees the White pawn remaining on e5
      And Alice sees the Black pawn remaining on d5
      And Alice hears no capture sound
      And Alice's activity receives no moves

    Scenario: Silent en passant removes the passed pawn without sound
      Given Alice has a silent chessboard ready for White to capture en passant from e5 to d6
      When Alice moves the piece from e5 to d6
      Then Alice sees a White pawn on d6
      And Alice sees no Black pawn on d5
      And Alice hears no chessboard sounds

  Rule: Promotion decides its replacement before offering the move to the activity

    Scenario: A last-rank pawn asks for its replacement before offering a move
      Given Alice has a chessboard ready for White's promotion from a7 to a8
      When Alice moves the piece from a7 to a8
      Then Alice is offered queen, rook, bishop and knight as the promotion choice
      And Alice sees the White pawn remaining on a7
      And Alice's activity receives no moves

    Scenario Outline: Each promotion choice completes exactly one promoted move
      Given Alice has a pending White promotion from a7 to a8
      When Alice chooses the promotion to a <piece>
      Then Alice sees a White <piece> on a8
      And Alice is not offered a promotion choice
      And Alice's activity receives one move promoting to a <piece>

      Examples:
        | piece  |
        | queen  |
        | rook   |
        | bishop |
        | knight |

    Scenario: Black's capture-promotion respects the Black orientation
      Given Alice has a chessboard facing Black with a pending Black capture-promotion from b2 to a1
      When Alice chooses the promotion to a knight
      Then Alice sees a Black knight on a1
      And Alice sees no captured piece after the animation
      And Alice's chessboard faces Black
      And Alice hears one capture sound followed by one promotion sound
      And Alice's activity receives one move promoting to a knight

    Scenario: Cancelling promotion keeps the pawn at its source
      Given Alice has a pending White promotion from a7 to a8
      When Alice cancels the promotion
      Then Alice sees the White pawn remaining on a7
      And Alice is not offered a promotion choice
      And Alice's activity receives no moves

    Scenario: Escape abandons promotion without offering a move
      Given Alice has a pending White promotion from a7 to a8
      When Alice cancels the promotion with Escape
      Then Alice sees the White pawn remaining on a7
      And Alice is not offered a promotion choice
      And Alice's activity receives no moves

    Scenario: A cancelled promotion can be requested again
      Given Alice has cancelled White's promotion from a7 to a8
      When Alice moves the piece from a7 to a8
      Then Alice is offered queen, rook, bishop and knight as the promotion choice
      And Alice sees the White pawn remaining on a7
      And Alice's activity receives no moves

    Scenario: Another piece can move before promotion has been requested
      Given Alice has a chessboard ready for White's promotion from a7 to a8
      When Alice moves the piece from h1 to h2
      Then Alice sees a White rook on h2
      And Alice sees the White pawn remaining on a7
      And Alice is not offered a promotion choice
      And Alice's activity receives one move

    Scenario: Another piece cannot move while the promotion choice waits
      Given Alice has a pending White promotion from a7 to a8
      When Alice moves the piece from h1 to h2
      Then Alice cannot move the rook on h1 until the promotion choice is decided or cancelled
      And Alice sees the White rook remaining on h1
      And Alice is still offered queen, rook, bishop and knight as the promotion choice
      And Alice's activity receives no moves

    Scenario: Automatic queen promotion completes a pawn's move immediately
      Given Alice has a chessboard ready for White's promotion from a7 to a8 with automatic queen promotion enabled
      When Alice moves the piece from a7 to a8
      Then Alice sees a White queen on a8
      And Alice is not offered a promotion choice
      And Alice's activity receives one move promoting to a queen
