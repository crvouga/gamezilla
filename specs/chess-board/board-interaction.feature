@domain:chess-board
Feature: Choose and complete chess moves
  When Alice plays chess, Alice wants selection and dragging to follow the same
  rules, so each completed move has one clear result in the activity.

  Rule: Selection offers only legal destinations for the side to move

    Scenario Outline: A movable own piece offers its legal destination
      Given Alice has a chessboard with a movable White <piece> on <source>
      When Alice selects the piece on <source>
      Then Alice has <source> selected
      And Alice sees <destination> as a legal destination

      Examples:
        | piece  | source | destination |
        | pawn   | e2     | e4          |
        | knight | g1     | f3          |
        | bishop | c4     | d5          |
        | rook   | a1     | a4          |
        | queen  | d1     | d4          |
        | king   | e1     | f1          |

    Scenario: Black's pawn offers destinations when Black is to move
      Given Alice has a chessboard after White's move from e2 to e4
      When Alice selects the piece on e7
      Then Alice has e7 selected
      And Alice sees only e5 and e6 as legal destinations

    Scenario: Choosing a selected piece again puts the selection down
      Given Alice has selected the piece on e2
      When Alice selects the piece on e2
      Then Alice sees no selection or legal destinations
      And Alice's activity receives no moves

    Scenario: Choosing another own piece changes selection without sound
      Given Alice has selected the piece on e2
      When Alice selects the piece on g1
      Then Alice has g1 selected
      And Alice sees only f3 and h3 as legal destinations
      And Alice hears no chessboard sounds

    Scenario: An opposing piece cannot be selected
      Given Alice has an interactive chessboard
      When Alice selects the piece on e7
      Then Alice cannot select e7 while White is to move
      And Alice sees no selection or legal destinations
      And Alice's activity receives no moves

    Scenario: An empty square cannot be selected
      Given Alice has an interactive chessboard
      When Alice selects the piece on e4
      Then Alice cannot select the empty square e4
      And Alice sees no selection or legal destinations
      And Alice's activity receives no moves

    Scenario: A pinned knight offers no move that exposes its king
      Given Alice has a chessboard with the White knight on e2 pinned to its king on e1 by the Black rook on e8
      When Alice selects the piece on e2
      Then Alice is not offered a legal destination for the knight on e2 because it is pinned to its king
      And Alice's activity receives no moves

    Scenario: A rook offers only the move that answers check
      Given Alice has a chessboard with White's king on e1 in check from Black's rook on e8 and White's rook on a2
      When Alice selects the piece on a2
      Then Alice sees only e2 as a legal destination

  Rule: A legal move passes the turn and is offered once however the piece is moved

    Scenario: A selected pawn completes one move and clears its selection
      Given Alice has selected the piece on e2
      When Alice moves the piece from e2 to e4
      Then Alice sees a White pawn on e4
      And Alice sees Black to move
      And Alice sees no selection or legal destinations
      And Alice sees e2 and e4 marked as the last move
      And Alice's activity receives one move

    Scenario: Dragging a pawn completes the same move as selection
      Given Alice has an interactive chessboard
      When Alice drags the piece from e2 to e4
      Then Alice sees a White pawn on e4
      And Alice sees Black to move
      And Alice sees no selection or legal destinations
      And Alice sees e2 and e4 marked as the last move
      And Alice's activity receives one move

    Scenario: Black's reply passes the turn back to White
      Given Alice has a chessboard after White's move from e2 to e4
      When Alice moves the piece from e7 to e5
      Then Alice sees a Black pawn on e5
      And Alice sees White to move
      And Alice sees e7 and e5 marked as the last move
      And Alice's activity receives one move

    Scenario: A newly held piece replaces the earlier selected source
      Given Alice has selected the piece on e2
      When Alice drags the piece from d2 to d4
      Then Alice sees a White pawn on d4
      And Alice sees the White pawn remaining on e2
      And Alice sees no selection or legal destinations
      And Alice's activity receives one move

    Scenario: White cannot move again before Black's reply
      Given Alice has a chessboard after White's move from e2 to e4
      When Alice moves the piece from d2 to d4
      Then Alice cannot move White's pawn while Black is to move
      And Alice sees the White pawn remaining on d2
      And Alice sees Black to move
      And Alice's activity receives no moves

  Rule: Captures complete a legal move while illegal destinations keep the position

    Scenario: A legal capture removes its victim and sounds once
      Given Alice has a chessboard ready for a capture
      When Alice moves the piece from e4 to d5
      Then Alice sees a White pawn on d5
      And Alice sees no captured piece after the animation
      And Alice hears one capture sound
      And Alice's activity receives one move

    Scenario: An illegal selected destination clears selection without a move
      Given Alice has selected the piece on e2
      And Alice has chessboard sound enabled
      When Alice moves the piece from e2 to e5
      Then Alice sees the White pawn remaining on e2
      And Alice sees no selection or legal destinations
      And Alice hears one illegal move sound
      And Alice's activity receives no moves

    Scenario: An illegal dragged destination returns the piece without a move
      Given Alice has an interactive chessboard
      When Alice drags the piece from e2 to e5
      Then Alice sees the White pawn remaining on e2
      And Alice sees no selection or legal destinations
      And Alice no longer holds a piece
      And Alice hears one illegal move sound
      And Alice's activity receives no moves

    Scenario: An own piece cannot be captured
      Given Alice has an interactive chessboard
      When Alice drags the piece from e2 to d2
      Then Alice cannot capture the White pawn on d2
      And Alice sees the White pawn remaining on e2
      And Alice sees the White pawn remaining on d2
      And Alice hears no capture sound
      And Alice's activity receives no moves

    Scenario: A move that keeps its king in check is refused
      Given Alice has a chessboard with White's king on e1 in check from Black's rook on e8 and White's rook on a2
      When Alice moves the piece from a2 to a3
      Then Alice cannot move the rook because its king would remain in check
      And Alice sees the White rook remaining on a2
      And Alice sees White's king on e1 marked as in check
      And Alice's activity receives no moves

    Scenario: A pinned knight cannot expose its king by moving
      Given Alice has a chessboard with the White knight on e2 pinned to its king on e1 by the Black rook on e8
      When Alice moves the piece from e2 to c3
      Then Alice cannot move the pinned knight because it would expose its king
      And Alice sees the White knight remaining on e2
      And Alice's activity receives no moves

    Scenario: A permitted reply removes the king's check
      Given Alice has a chessboard with White's king on e1 in check from Black's rook on e8 and White's rook on a2
      When Alice moves the piece from a2 to e2
      Then Alice sees a White rook on e2
      And Alice sees neither king marked as in check
      And Alice's activity receives one move

    Scenario: A silent illegal move preserves the position without sound
      Given Alice has a silent chessboard
      When Alice moves the piece from e2 to e5
      Then Alice sees the White pawn remaining on e2
      And Alice hears no chessboard sounds
      And Alice's activity receives no moves

  Rule: Putting a held piece down without a legal destination abandons the move

    Scenario: Dropping a piece on its own square puts it down without a move
      Given Alice is dragging the piece on e2
      When Alice drops the held piece on e2
      Then Alice sees a White pawn on e2
      And Alice no longer holds a piece
      And Alice sees no selection or legal destinations
      And Alice's activity receives no moves

    Scenario: Dropping outside the chessboard puts the piece back
      Given Alice is dragging the piece on e2
      When Alice drops the held piece outside the chessboard
      Then Alice sees the White pawn remaining on e2
      And Alice no longer holds a piece
      And Alice's activity receives no moves

    Scenario: Dragging an opposing piece cannot offer a move
      Given Alice has an interactive chessboard
      When Alice drags the piece from e7 to e5
      Then Alice cannot move Black's pawn while White is to move
      And Alice no longer holds a piece
      And Alice sees the Black pawn remaining on e7
      And Alice's activity receives no moves

    Scenario: Dragging an empty square cannot offer a move
      Given Alice has an interactive chessboard
      When Alice drags the piece from e4 to e5
      Then Alice cannot move a piece from the empty square e4
      And Alice no longer holds a piece
      And Alice's activity receives no moves

  Rule: Check is distinguished from checkmate and stalemate before further moves are offered

    Scenario: An ordinary move has no check or end sound
      Given Alice has an interactive chessboard
      When Alice moves the piece from e2 to e4
      Then Alice hears one move sound with no check or end sounds
      And Alice sees neither king marked as in check

    Scenario: A checking move identifies the threatened king
      Given Alice has a chessboard ready for White to check Black by moving the rook from a2 to e2
      When Alice moves the piece from a2 to e2
      Then Alice sees Black's king on e8 marked as in check
      And Alice is told Black is in check
      And Alice hears one move sound followed by one check sound

    Scenario: Checkmate announces the result with each sound once
      Given Alice has a chessboard ready for White to checkmate Black by moving the queen from g6 to g7
      When Alice moves the piece from g6 to g7
      Then Alice is told Black is checkmated
      And Alice sees Black's king on h8 marked as in check
      And Alice hears one move sound followed by one check sound and one end sound
      And Alice's activity receives one move

    Scenario: A mating capture sounds capture before check and the end sound
      Given Alice has a chessboard ready for White to checkmate Black by capturing the rook on g7 with the queen on g6
      When Alice moves the piece from g6 to g7
      Then Alice is told Black is checkmated
      And Alice hears one capture sound followed by one check sound and one end sound
      And Alice's activity receives one move

    Scenario: Silent checkmate preserves its announcement without any sound
      Given Alice has a silent chessboard ready for White to checkmate Black by moving the queen from g6 to g7
      When Alice moves the piece from g6 to g7
      Then Alice is told Black is checkmated
      And Alice hears no chessboard sounds

    @regression:chessboard-stalemate-announcement
    Scenario: Stalemate announces its result without check feedback
      Given Alice has a chessboard ready for White to stalemate Black by moving the queen from f5 to g6
      When Alice moves the piece from f5 to g6
      Then Alice is told Black is stalemated
      And Alice sees neither king marked as in check
      And Alice hears one move sound followed by one end sound with no check sound

    @regression:chessboard-stalemate-announcement
    Scenario: Silent stalemate preserves its result without any sound
      Given Alice has a silent chessboard ready for White to stalemate Black by moving the queen from f5 to g6
      When Alice moves the piece from f5 to g6
      Then Alice is told Black is stalemated
      And Alice hears no chessboard sounds

    @regression:chessboard-terminal-selection
    Scenario: A checkmated chessboard refuses another move
      Given Alice has a chessboard with Black checkmated
      When Alice selects the piece on h8
      Then Alice is not offered another move because Black is checkmated
      And Alice sees no selection or legal destinations
      And Alice's activity receives no moves

    @regression:chessboard-terminal-selection
    Scenario: A stalemated chessboard refuses another move
      Given Alice has a chessboard with Black stalemated
      When Alice selects the piece on h8
      Then Alice is not offered another move because Black is stalemated
      And Alice sees no selection or legal destinations
      And Alice's activity receives no moves
