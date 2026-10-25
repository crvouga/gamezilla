@domain:synthetic-population
Feature: Synthetic Users choose a game
  When people want a multiplayer opponent, they want Synthetic Users to choose the games
  people can play, so automated opponents are available for those games.

  Rule: A Synthetic User can look for a multiplayer opponent for any offered game
    No counter-example: only games offered by the app can be chosen.

    Scenario Outline: A Synthetic User looks for a multiplayer opponent for <game>
      Given the Synthetic User "Cedar" is ready to play "<game>"
      When "Cedar" starts its next activity
      Then "Cedar" is looking for a multiplayer opponent for "<game>"

      Examples:
        | game |
        | chess |
        | Connect Four |
        | Battleship |
        | Pong |
