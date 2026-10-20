@domain:games
Feature: Who may move, and when
  When a solver makes a move in a puzzle of the game, they want only moves the
  game's rules allow, by the side whose turn it is, to count, so a slip is
  never held against them. A move the game's rules do not allow is no move at
  all: the board stays as it was and nothing is held against the solver. No
  move can be made while a wrong move is waiting for a retry, or once the
  puzzle is over.

  Rule: Only the solver may move and only while the puzzle is being solved

    Background:
      Given Alice is signed in
      And Alice is solving the game's known puzzle

    Scenario: A correct continuation leaves the next solution move for the solver
      When Alice plays the next move of the solution
      Then it is Alice's turn
      And Alice is solving the puzzle after the first move of the solution

    Scenario: A move the game's rules do not allow is refused and not held against the solver
      When Alice tries a move the game's rules do not allow
      Then Alice's board is unchanged
      And Alice is still asked to find the next move
      And Alice's puzzle rating is 1500

    Scenario: No move can be made after a wrong move until a retry
      When Alice plays a wrong move
      Then Alice cannot make a move

    Scenario: No move can be made once the puzzle is over
      When Alice solves the puzzle
      Then Alice cannot make a move
