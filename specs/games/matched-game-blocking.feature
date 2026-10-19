@domain:games
Feature: Blocking when finding an opponent
  When someone has blocked another person, both want never to be paired together, so a block works when finding an opponent as it does in custom games.

  Rule: Blocking in either direction stops two people from being paired

    Background:
      Given Alice and Bob are seeking an opponent for the game at 5+0

    Scenario: People who have not blocked each other are paired
      When they are paired
      Then Alice and Bob receive the same new game on opposite sides

    Scenario: Blocking before they are paired keeps both people seeking other opponents
      Given Alice has blocked Bob
      When they are paired
      Then Alice and Bob are still waiting for other opponents
      And Bob is not told Alice blocked him

  Rule: A block after they were paired does not end their matched game
    No counter-example: blocking changes nothing about a matched game already under way, as with a custom game.

    Scenario: A block after they were paired keeps the matched game
      Given Alice blocked Bob after they were paired
      When Alice opens finding an opponent
      Then Alice keeps her matched game with Bob
