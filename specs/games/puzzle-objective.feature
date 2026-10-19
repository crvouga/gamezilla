@domain:games
Feature: A win for the solver solves the puzzle
  When a solver wins a puzzle of the game with a move that is not in its
  line, they want it accepted, so every way the game's rules count as
  the same win has the same successful outcome. It holds for every game
  offering puzzles whose known puzzles include one that can be won another
  way.

  Background:
    Given Alice is signed in
    And Alice is solving the game's known puzzle that can be won another way

  Rule: A move that wins for the solver solves the puzzle, even off the puzzle's line

    Scenario: Winning another way solves the puzzle
      When Alice plays the other winning last move
      Then Alice's puzzle is solved within 20 seconds
      And Alice's game log records that puzzle as solved
      And Alice's stats show 1 played, 1 solved, and 100% accuracy

    Scenario: A move that neither follows the solution nor wins is wrong
      When Alice plays a wrong move
      Then Alice is told the move was wrong

  Rule: A puzzle won another way has the same lasting result offline
    No counter-example: returning cannot refuse a decided win.

    Scenario: A puzzle won another way offline stays solved once the connection comes back
      Given Alice has won the puzzle another way offline
      When the connection comes back
      Then Alice's game log records that puzzle as solved
      And Alice's stats show 1 played, 1 solved, and 100% accuracy
      And Alice's puzzle rating is above 1500

    Scenario: Two devices winning the puzzle different ways count one solved puzzle
      Given Alice is also signed in on another device
      And Alice has won the puzzle a different way on each device offline
      When the connection comes back
      Then Alice's stats show 1 played, 1 solved, and 100% accuracy
      And Alice's other device shows 1 played, 1 solved, and 100% accuracy
      And both of Alice's devices show the same puzzle rating within 30 seconds
