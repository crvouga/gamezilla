@domain:chess
Feature: A win needs mating material
  When a participant runs out of time, resigns or stays away, the other participant wants the result to respect the remaining material, so a bare king cannot be awarded an impossible win.

  Rule: Running out of time draws when the other side cannot mate with the remaining material
    No counter-example: the remaining material decides the result, and nobody can choose a win it cannot give.

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
    No counter-example: the remaining material decides the result, and nobody can choose a win it cannot give.

    Scenario: Resigning against a bare king draws
      Given Alice has an active Custom Game with a queen against Bob's bare king
      When Alice resigns the Custom Game
      Then The Custom Game is completed as a draw

    Scenario: Resigning to the queen awards White the game
      Given Alice has an active Custom Game with a queen against Bob's bare king
      When Bob resigns the Custom Game
      Then Alice wins the Custom Game by resignation

  Rule: Claiming the win draws when the claimant cannot mate with the remaining material
    No counter-example: the remaining material decides the result, and nobody can choose a win it cannot give.

    Scenario: A bare king's claim draws
      Given Bob hosts an active Custom Game with Alice's queen against Bob's bare king
      And Alice has been away from the Custom Game for 60 seconds
      When Bob claims the win in the Custom Game
      Then The Custom Game is completed as a draw

    Scenario: The queen's claim wins
      Given Alice has an active Custom Game with a queen against Bob's bare king
      And Bob has been away from the Custom Game for 60 seconds
      When Alice claims the win in the Custom Game
      Then Alice wins the Custom Game because Bob stayed away
