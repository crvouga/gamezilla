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

    Scenario: The opponent's side cannot be moved
      When Alice tries to make a move for the opponent's side
      Then Alice is still asked to find the next move
      And Alice's board is unchanged

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
