@domain:chess
Feature: A win on time needs mating material
  When a participant runs out of time, the other participant wants the result to respect the remaining material, so a bare king cannot be awarded an impossible win.

  Rule: Running out of time draws when the other side cannot mate with the remaining material
    No counter-example: the remaining material decides the result, and nobody can choose a win it cannot give.

    Scenario: Running out against a bare king draws
      Given Alice has a timed custom game with a queen against Bob's bare king
      And White has one second left in the custom game
      When 1 second passes
      Then The custom game is completed as a draw

    Scenario: A queen can win on time
      Given Alice has a timed custom game with a queen against Bob's bare king
      And Black has one second left in the custom game
      When 1 second passes
      Then Alice wins the custom game on time
