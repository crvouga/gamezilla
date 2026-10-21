@domain:journeys
Feature: Play Battleship with another person
  When Alice and Bob want a game together, they want to find each other and play Battleship, so both see the same completed game.

  Rule: Two people can find each other and complete Battleship
    No counter-example: everything refused or interrupted along the way is covered by the Battleship rules.

    Scenario: Two people share the completed Battleship game
      When Alice and Bob play Battleship from fresh devices
      Then Alice and Bob see the same completed Battleship game
