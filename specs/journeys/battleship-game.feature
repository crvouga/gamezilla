@domain:journeys
Feature: Play Battleship
  When Alice wants to play Battleship, she wants to start a game against Bob or a bot so she can play with the opponent she chooses.

  Rule: Two people can find each other and complete Battleship
    No counter-example: everything refused or interrupted along the way is covered by the Battleship rules.

    Scenario: Two people share the completed Battleship game
      When Alice and Bob play Battleship from fresh devices
      Then Alice and Bob see the same completed Battleship game

  Rule: A guest can start Battleship against a bot with a fleet ready to play
    No counter-example: the game provides a fleet when the guest starts against a bot.

    Scenario: A fresh guest opens the Battleship board against a bot
      When Alice starts "Battleship" with bots from a fresh device
      Then Alice sees "Battleship" under way against bots
