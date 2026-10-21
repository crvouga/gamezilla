@domain:battleship
Feature: Start shooting in Battleship
  When Alice and Bob have placed their fleets, they want shooting to begin only once both are ready and the game starts, so nobody shoots at an incomplete fleet.

  Rule: Shooting begins once both players are ready and the game starts

    Scenario: Starting the game gives the first player the first turn
      Given Alice and Bob are ready for the custom game with random fleets
      When Alice starts the custom game
      Then Alice has the Battleship turn

    Scenario: The game cannot start while a fleet is incomplete
      Given Alice is ready for the custom game with a random fleet
      And Bob has placed four of his five ships
      When Alice starts the custom game
      Then Alice is told every person must be ready

    Scenario: A player without a connection cannot start the game
      Given Alice and Bob are ready for the custom game with random fleets
      And Alice is offline
      When Alice starts the custom game
      Then Alice is told the game needs a connection

    Scenario: A shot before the game starts is refused
      Given Alice is placing her Battleship fleet
      When Alice shoots at C3
      Then Alice is told shooting begins once the game starts
      And Alice's targeting board is empty
