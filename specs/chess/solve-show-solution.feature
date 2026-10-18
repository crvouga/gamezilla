@domain:chess
Feature: A shown chess solution ends in checkmate
  When a solver cannot find the mate in a chess puzzle, they want the shown
  solution to play out all the way to checkmate, so they see the whole mate.

  Rule: Showing a mating puzzle's solution plays its line out to checkmate
    No counter-example: showing the solution always plays the whole line; how it stops play and counts is every game's.

    Scenario: The rest of the line plays out to checkmate
      Given Alice is signed in
      And Alice is solving the hook-mate puzzle
      When Alice shows the solution
      Then Alice's board reaches checkmate at move 4 of the line within 20 seconds
