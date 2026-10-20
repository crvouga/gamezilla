@domain:games
Feature: Automatic moves in puzzles with an opponent
  When a solver plays a puzzle with an opponent, they want its setup move
  and replies to play themselves, so they can concentrate on the solution.
  This applies only to games whose puzzles have an opponent.

  Rule: The opponent's setup move is already played when the puzzle opens
    No counter-example: A puzzle with an opponent always opens after its setup move; puzzles without an opponent have none.

    Scenario: The setup move is visible when the puzzle opens
      Given Alice is signed in
      When Alice opens the game's known puzzle
      Then Alice's board shows the setup move as the last move
      And it is Alice's turn

  Rule: The opponent answers a correct continuation and cannot be moved by the solver

    Background:
      Given Alice is signed in
      And Alice is solving the game's known puzzle

    Scenario: A correct continuation receives its automatic reply
      When Alice plays the next move of the solution
      Then the opponent replies with the next move of the line by itself
      And Alice is solving the puzzle after the first move of the solution

    Scenario: The solver cannot move the opponent's side
      When Alice tries to make a move for the opponent's side
      Then Alice is still asked to find the next move
      And Alice's board is unchanged
