@domain:chess
Feature: Multiplayer chess needs a connection to change anything
  When a person's device is offline, they want to see where their game and
  search stood, so nothing they try offline changes a game behind their
  multiplayer opponent's back.

  Rule: An offline person sees their last known multiplayer board but cannot change the game

    Scenario: An offline person keeps seeing their last known multiplayer board
      Given Alice has a new multiplayer game and her phone is offline
      When Alice opens multiplayer chess
      Then Alice's phone keeps its last known multiplayer board

    Scenario: An offline person cannot resign
      Given Alice has a new multiplayer game and her phone is offline
      When Alice resigns multiplayer chess
      Then Alice is told multiplayer chess needs a connection
      And the multiplayer game is still unfinished

    Scenario: An offline person cannot abort the game
      Given Alice has a new multiplayer game and her phone is offline
      When Alice aborts the multiplayer game
      Then Alice is told multiplayer chess needs a connection
      And the multiplayer game is still unfinished

    Scenario: An offline person cannot offer a multiplayer draw
      Given Alice has a new multiplayer game and her phone is offline
      When Alice offers a multiplayer draw
      Then Alice is told multiplayer chess needs a connection
      And Bob is not offered a multiplayer draw

    Scenario: An offline person cannot accept a multiplayer draw
      Given Bob has offered Alice a multiplayer draw
      And Alice's phone is offline
      When Alice accepts the multiplayer draw
      Then Alice is told multiplayer chess needs a connection
      And the multiplayer game is still unfinished

    Scenario: An offline person cannot decline a multiplayer draw
      Given Bob has offered Alice a multiplayer draw
      And Alice's phone is offline
      When Alice declines the multiplayer draw
      Then Alice is told multiplayer chess needs a connection
      And Alice is still offered a multiplayer draw

  Rule: An offline person sees their last known search but cannot change it or a multiplayer rematch

    Scenario: An offline person keeps seeing their last known search
      Given Alice is looking for a 5+0 chess opponent and her phone is offline
      When Alice opens multiplayer chess
      Then Alice sees she is still looking for a 5+0 chess opponent

    Scenario: An offline person cannot stop finding a chess opponent
      Given Alice is looking for a 5+0 chess opponent and her phone is offline
      When Alice stops finding a chess opponent
      Then Alice is told multiplayer chess needs a connection
      And Alice is still looking for a chess opponent

    Scenario: An offline person cannot find a new opponent
      Given Alice's 5+0 multiplayer game with Bob is over and her phone is offline
      When Alice finds a new opponent
      Then Alice is told multiplayer chess needs a connection
      And Alice is not looking for a chess opponent

    Scenario: An offline person cannot offer a multiplayer rematch
      Given Alice's 5+0 multiplayer game with Bob is over and her phone is offline
      When Alice offers a multiplayer rematch
      Then Alice is told multiplayer chess needs a connection
      And Bob is not offered a multiplayer rematch

    Scenario: An offline person cannot accept a multiplayer rematch
      Given Bob has offered Alice a multiplayer rematch
      And Alice's phone is offline
      When Alice accepts the multiplayer rematch
      Then Alice is told multiplayer chess needs a connection
      And Alice is still offered a multiplayer rematch

    Scenario: An offline person cannot decline a multiplayer rematch
      Given Bob has offered Alice a multiplayer rematch
      And Alice's phone is offline
      When Alice declines the multiplayer rematch
      Then Alice is told multiplayer chess needs a connection
      And Alice is still offered a multiplayer rematch
