@domain:chess
Feature: Every chess move in a Custom Game
  When a participant plays a Custom Game, they want every legal chess move available, so the game follows the same rules as any game of chess.

  Rule: Promoting asks which piece and plays the piece chosen
    No counter-example: every promotion is the participant's choice; the queen is never chosen for them.

    Background:
      Given Alice has an active Custom Game one move before White promotes on e8

    Scenario: Promoting asks White which piece
      When Alice plays e7-e8 in the Custom Game
      Then Alice is asked which piece White promotes to on e8

    Scenario: Underpromotion to a knight is played as chosen
      When Alice plays e7-e8 and promotes to a knight in the Custom Game
      Then The Custom Game move list shows e8=N
      And Black is to move in the Custom Game

  Rule: Castling and en passant are legal moves, and castling through check is illegal

    Scenario: White castles kingside
      Given Alice has an active Custom Game one move before White castles kingside
      When Alice plays e1-g1 in the Custom Game
      Then The Custom Game move list shows O-O
      And Black is to move in the Custom Game

    Scenario: White captures en passant
      Given Alice has an active Custom Game one move before White captures en passant on d6
      When Alice plays e5-d6 in the Custom Game
      Then The Custom Game move list shows exd6
      And Black is to move in the Custom Game

    Scenario: Castling through check is refused
      Given Alice has an active Custom Game where White's king would castle through check
      When Alice plays e1-g1 in the Custom Game
      Then Alice is told the move is illegal
      And White is to move in the Custom Game
