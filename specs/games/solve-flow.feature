@domain:games
Feature: The solve flow
  When a solver opens a puzzle of the game, they want to know at once whose
  move it is and whether each move was right, so solving feels like playing.
  A puzzle starts before the solver's first move. A puzzle without an
  opponent has no setup move or automatic reply: every move of its line is
  the solver's. Finishing the line solves the puzzle, and a wrong move is
  called out at once and stays the attempt's outcome, however the puzzle
  is solved afterwards.

  Rule: The board follows the solution and tells the solver when a move is wrong

    Scenario: The puzzle opens ready for the solver's first move
      Given Alice is signed in
      When Alice opens the game's known puzzle
      Then Alice's board faces the solver's side
      And Alice's board shows the start of the puzzle
      And Alice is prompted to find the next move for the solver's side

    Scenario: Finishing the line solves the puzzle
      Given Alice is signed in
      And Alice is solving the game's known puzzle
      And Alice has played the next move of the solution
      When Alice plays the last move of the solution
      Then Alice's puzzle is solved within 20 seconds
      And Alice feels the success haptic

    Scenario: A wrong move is called out at once
      Given Alice is signed in
      And Alice is solving the game's known puzzle
      When Alice plays a wrong move
      Then Alice is told the move was wrong
      And Alice feels the error haptic

