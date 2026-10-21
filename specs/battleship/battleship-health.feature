@domain:battleship @synthetic
Feature: Battleship remains available
  When people play Battleship, the team wants two people able to find each other and play a whole game, so trouble is detected before more people encounter it.

  Rule: The environment supports a complete Battleship game

    Scenario: Battleship can be played to a victory
      When the team checks Battleship in this environment
      Then two people can find each other and play Battleship to a victory they both see
      And neither person saw the other's fleet beyond what their shots showed
