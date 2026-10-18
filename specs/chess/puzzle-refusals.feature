@domain:chess
Feature: The Puzzle Assistant explains why nothing happens from an earlier position
  When a chess solver tries to play, take a hint or show the solution while
  looking back at an earlier position, they want the Puzzle Assistant to say
  why nothing happened, so they know to return to the current position.

  Background:
    Given Alice is signed in
    And Alice is solving the four-move mate-in-two puzzle
    And Alice has played g6-g5
    And Alice is reviewing an earlier position in the puzzle

  Rule: The assistant explains that the solver is reviewing an earlier position
    No counter-example: from the current position the move, hint or shown solution goes ahead, as every game's puzzles show.

    Scenario: A move from an earlier position is explained
      When Alice tries a move from that earlier position
      Then Alice's assistant explains that they are reviewing an earlier position

    Scenario: A hint from an earlier position is explained
      When Alice tries a hint from that earlier position
      Then Alice's assistant explains that they are reviewing an earlier position

    Scenario: Showing the solution from an earlier position is explained
      When Alice tries to show the solution from that earlier position
      Then Alice's assistant explains that they are reviewing an earlier position
