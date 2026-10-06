@domain:chess
Feature: Find someone to play multiplayer chess
  When a person wants to play ordinary chess against another person, they
  want a compatible chess opponent and one lasting game, so matchmaking gives
  both people the same multiplayer game at the time control they chose.

  Rule: Finding a chess opponent needs an account and a connection

    Scenario: A free account can find a chess opponent
      Given Alice has a free account and a connection
      When Alice finds a chess opponent for 5+0
      Then Alice is looking for a chess opponent

    Scenario: A guest is invited to sign in
      Given Alice is a guest
      And Alice is hosting a space
      When Alice finds a chess opponent for 5+0
      Then Alice is invited to sign in
      And Alice is not looking for a chess opponent

    Scenario: An offline account cannot ask for a chess opponent
      Given Alice has an account without a connection
      When Alice finds a chess opponent for 5+0
      Then Alice is told finding an opponent needs a connection
      And Alice is not looking for a chess opponent

  Rule: A person cannot seek a second chess opponent while a multiplayer game is unfinished

    Scenario: A person may find a chess opponent again after their multiplayer game is over
      Given Alice's multiplayer game with Bob is over
      When Alice finds a chess opponent for 5+0
      Then Alice is looking for a chess opponent

    Scenario: Another device cannot seek a second unfinished game
      Given Alice has an unfinished multiplayer game with Bob
      When Alice finds a chess opponent for 5+0 on another device
      Then Alice is told to finish her multiplayer game first
      And Alice keeps her multiplayer game with Bob

  Rule: A participant of an active Custom Game finishes it before finding a chess opponent

    Background:
      Given Alice has a free account and a connection

    Scenario: A person may find an opponent after their Custom Game is completed
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      When Alice finds a chess opponent
      Then Alice is looking for a chess opponent

    Scenario: A participant of an active Custom Game cannot find an opponent
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice finds a chess opponent
      Then Alice is told to finish her Custom Game first
      And Alice is not looking for a chess opponent

  Rule: One matchmaking match creates one multiplayer game for its two people
    No counter-example: opening the accepted match never asks for a new match or another game.

    Scenario: A matched pair receive opposite sides of the same new game
      Given Alice and Bob are looking for 5+0 chess opponents
      When a matchmaking match is formed for Alice and Bob
      Then Alice and Bob have the same multiplayer game
      And one is White and the other is Black
      And White has the first multiplayer turn

    Scenario: Opening an accepted matchmaking match again keeps the same game
      Given Alice and Bob have a multiplayer game from a matchmaking match
      When Alice opens multiplayer chess
      Then Alice and Bob keep the same multiplayer game and board

  Rule: A person's search and game follow them across devices
    No counter-example: another device observes the person's accepted search or game; opening it creates neither.

    Scenario: Another device opens the person's accepted opponent search
      Given Alice is looking for a chess opponent
      When Alice opens multiplayer chess on another device
      Then Alice sees her same opponent search on that device

    Scenario: Returning to multiplayer chess does not start a new game
      Given Alice has an unfinished multiplayer game with Bob
      When Alice opens multiplayer chess on another device
      Then Alice sees the same multiplayer game and board on that device

  Rule: Stopping an opponent search keeps any game already formed

    Scenario: A waiting person can stop finding a chess opponent
      Given Alice is looking for a chess opponent
      When Alice stops finding a chess opponent
      Then Alice is not looking for a chess opponent

    Scenario: A person cannot stop a search that already became a game
      Given Alice has an unfinished multiplayer game with Bob
      When Alice stops finding a chess opponent
      Then Alice is told she has no opponent search to stop
      And Alice keeps her multiplayer game with Bob

