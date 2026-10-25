@domain:chess
Feature: Drawn positions finish the custom game
  When chess can no longer produce a winner, the participants want a draw, so a game cannot continue after stalemate, a repeated position or another drawn position.

  Rule: Stalemate completes the game as a draw

    Scenario: White's move leaves Black with no legal move and no check
      Given Alice has a custom game one move before stalemate
      When Alice plays c8-e6 in the custom game
      Then The custom game is completed as a draw

    Scenario: A king in check with a legal reply is not stalemated
      Given Alice has a custom game one move before stalemate
      When Alice plays c8-e8 in the custom game
      Then Black is in check in the active custom game
      And Black is to move in the custom game

  Rule: Insufficient mating material completes the game as a draw

    Scenario: Capturing the last queen leaves only the two kings
      Given Alice has a custom game one move before only the two kings remain
      When Bob plays e7-f6 in the custom game
      Then The custom game is completed as a draw

    Scenario: Keeping the last queen leaves mating material
      Given Alice has a custom game one move before only the two kings remain
      When Bob plays e7-d7 in the custom game
      Then The custom game remains active
      And neither person has won the custom game

  Rule: Fifty moves by each side without a pawn move or capture complete the game as a draw

    Scenario: Black's fiftieth quiet move completes the draw
      Given Alice has a custom game one move before fifty moves without a pawn move or capture
      When Bob plays a4-b6 in the custom game
      Then The custom game is completed as a draw

    Scenario: White's fiftieth quiet move still gives Black a turn
      Given Alice has a custom game two moves before fifty moves without a pawn move or capture
      When Alice plays b1-a1 in the custom game
      Then The custom game remains active
      And Black is to move in the custom game

  Rule: A repeated position three times completes the game as a draw
    No counter-example: a repetition comes from the moves played, not a choice anyone makes; the second repetition shows play continuing.

    Scenario: The third repetition ends the game
      Given Alice has a custom game one move before the third repetition
      When Bob plays f6-g8 in the custom game
      Then The custom game is completed as a draw

    Scenario: A second repetition leaves the game active
      Given Alice has a custom game one move before the second repetition
      When Bob plays f6-g8 in the custom game
      Then The custom game remains active
      And neither person has won the custom game
