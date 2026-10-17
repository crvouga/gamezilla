@domain:chess
Feature: A multiplayer game record another chess program opens
  When a multiplayer game is over, its people want its game record in Portable Game Notation, so they can go through the game in another chess program.

  Rule: A game record gives the multiplayer result in Portable Game Notation and every move in algebraic notation, the way other chess programs read one
    No counter-example: the person copying chooses nothing about what a game record holds.

    Scenario: The game record of a multiplayer game Black won gives the multiplayer result as 0-1 and opens in another chess program
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      And Alice has resigned multiplayer chess
      When Bob copies the game record
      Then the game record Bob copied gives the multiplayer result as 0-1, the time control as 5+0 and the moves as "1. e4 e5"
      And the game record Bob copied can be opened in another chess program
