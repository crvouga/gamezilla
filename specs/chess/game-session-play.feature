@domain:chess
Feature: Play the game session
  When a game session is active, each participant wants every move written in chess notation and checkmate to end the game, so people and bots follow the same chess rules.

  Rule: The move list writes each move in algebraic notation
    No counter-example: the notation only describes a move that was played; nobody chooses how it is written.

    Scenario: White plays a legal opening move
      Given Alice has an active game session between Alice as White and Bob as Black
      When Alice plays e2-e4 in the game session
      Then Black is to move in the game session
      And The game session move list shows e4

  Rule: Checkmate ends the game immediately
    No counter-example: checkmate comes from the moves played, not a choice anyone makes, and the finished game then keeps its result as every game's does.

    Scenario: The mating move awards Black the game
      Given Alice has an active game session one move before Black's checkmate
      When Bob plays d8-h4 in the game session
      Then Bob wins the game session by checkmate
