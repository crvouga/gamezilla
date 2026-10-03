@domain:chess
Feature: A win needs mating material
  When a participant runs out of time or resigns, the other participant wants the result to respect the remaining material, so a bare king cannot be awarded an impossible win.

  Rule: Running out of time draws when the other side cannot mate with the remaining material

    Scenario: Running out against a bare king draws
      Given Alice has a timed Custom Game with a queen against Bob's bare king
      And White has one second left in the Custom Game
      When 1 second passes
      Then The Custom Game is completed as a draw

    Scenario: A queen can win on time
      Given Alice has a timed Custom Game with a queen against Bob's bare king
      And Black has one second left in the Custom Game
      When 1 second passes
      Then Alice wins the Custom Game on time

  Rule: Resignation draws when the other side cannot mate with the remaining material

    Scenario: Resigning against a bare king draws
      Given Alice has an active Custom Game with a queen against Bob's bare king
      When Alice resigns the Custom Game
      Then The Custom Game is completed as a draw

    Scenario: Resigning to the queen awards White the game
      Given Alice has an active Custom Game with a queen against Bob's bare king
      When Bob resigns the Custom Game
      Then Alice wins the Custom Game by resignation
