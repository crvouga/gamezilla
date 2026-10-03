@domain:chess
Feature: Drawn positions finish the Custom Game
  When chess can no longer produce a winner, the participants want a draw, so a game cannot continue after stalemate or a drawn position.

  Rule: Stalemate completes the game as a draw

    Scenario: White's move leaves Black with no legal move and no check
      Given Alice has a Custom Game one move before stalemate
      When Alice plays c8-e6 in the Custom Game
      Then The Custom Game is completed as a draw

    Scenario: A king in check with a legal reply is not stalemated
      Given Alice has a Custom Game one move before stalemate
      When Alice plays c8-e8 in the Custom Game
      Then Black is in check in the active Custom Game
      And Black is to move in the Custom Game

  Rule: Insufficient mating material completes the game as a draw

    Scenario: Capturing the last queen leaves only the two kings
      Given Alice has a Custom Game one move before only the two kings remain
      When Bob plays e7-f6 in the Custom Game
      Then The Custom Game is completed as a draw

    Scenario: Keeping the last queen leaves mating material
      Given Alice has a Custom Game one move before only the two kings remain
      When Bob plays e7-d7 in the Custom Game
      Then The Custom Game remains active
      And Neither person has won the Custom Game

  Rule: Fifty moves by each side without a pawn move or capture complete the game as a draw

    Scenario: Black's fiftieth quiet move completes the draw
      Given Alice has a Custom Game one move before fifty moves without a pawn move or capture
      When Bob plays a4-b6 in the Custom Game
      Then The Custom Game is completed as a draw

    Scenario: White's fiftieth quiet move still gives Black a turn
      Given Alice has a Custom Game two moves before fifty moves without a pawn move or capture
      When Alice plays b1-a1 in the Custom Game
      Then The Custom Game remains active
      And Black is to move in the Custom Game
