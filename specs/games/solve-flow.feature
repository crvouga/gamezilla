@domain:games
Feature: The solve flow
  When a solver opens a puzzle of the game, they want to know at once whose
  move it is and whether each move was right, so solving feels like playing.
  A puzzle opens with the opponent's setup move already played and the board
  facing the solver, who is prompted to move. Each correct move is answered
  by the opponent's reply, played by itself. Finishing the line solves the
  puzzle, and a wrong move is called out at once and stays the attempt's
  outcome, however the puzzle is solved afterwards.

  Rule: The board follows the solution and tells the solver when a move is wrong

    Scenario: The puzzle opens after the opponent's setup move, facing the solver
      Given Alice is signed in
      When Alice opens the game's known puzzle
      Then Alice's board faces the solver's side
      And Alice's board shows the setup move as the last move
      And it is Alice's turn
      And Alice is prompted to find the next move for the solver's side

    Scenario: A correct move is answered by the opponent's reply, played by itself
      Given Alice is signed in
      And Alice is solving the game's known puzzle
      When Alice plays the next move of the solution
      Then the opponent replies with the next move of the line by itself
      And it is Alice's turn
      And Alice is solving the puzzle at move 3 of the line

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

