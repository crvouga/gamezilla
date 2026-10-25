@domain:chess
Feature: Play the custom game
  When a custom game is active, each participant wants every move written in chess notation and checkmate to end the game, so people and bots follow the same chess rules.

  Rule: The move list writes each move in algebraic notation
    No counter-example: the notation only describes a move that was played; nobody chooses how it is written.

    Scenario: White plays a legal opening move
      Given Alice has an active custom game between Alice as White and Bob as Black
      When Alice plays e2-e4 in the custom game
      Then Black is to move in the custom game
      And The custom game move list shows e4

  Rule: Checkmate ends the game immediately
    No counter-example: checkmate comes from the moves played, not a choice anyone makes, and the finished game then keeps its result as every game's does.

    Scenario: The mating move awards Black the game
      Given Alice has an active custom game one move before Black's checkmate
      When Bob plays d8-h4 in the custom game
      Then Bob wins the custom game by checkmate
