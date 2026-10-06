@domain:chess
Feature: Blocking in Custom Games
  When someone has blocked another person, both want to stay out of a Custom Game together, so a block works for Custom Games as it does for finding a chess opponent.

  Rule: The creator cannot invite someone when either of them has blocked the other

    Background:
      Given Alice has a configuring Custom Game
      And Bob is in Alice's space

    Scenario: A block with someone else does not stop an invitation
      Given Alice has blocked Carol
      When Alice invites Bob to Black in the Custom Game
      Then Black is reserved for Bob in the Custom Game

    Scenario: The creator cannot invite someone she blocked
      Given Alice has blocked Bob
      When Alice invites Bob to Black in the Custom Game
      Then Alice is told Bob cannot be invited
      And Black is an open place in the Custom Game

    Scenario: The creator is not told that the person she invites blocked her
      Given Bob has blocked Alice
      When Alice invites Bob to Black in the Custom Game
      Then Alice is told Bob cannot be invited
      And Black is an open place in the Custom Game

  Rule: Someone with a block between them and the creator cannot claim an open place in the creator's game

    Background:
      Given Alice has a configuring Custom Game
      And Bob is in Alice's space

    Scenario: A block with someone else does not stop a claim
      Given Bob has blocked Carol
      When Bob claims Black in the Custom Game
      Then Black is Bob in the Custom Game

    Scenario: A blocked person cannot claim the open place
      Given Alice has blocked Bob
      When Bob claims Black in the Custom Game
      Then Bob is told that side is not available to him
      And Bob is not told Alice blocked him

  Rule: A block after the game has started does not end it
    No counter-example: blocking changes nothing about a game already under way, as with a multiplayer game.

    Scenario: Blocking the other participant keeps the active game
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice blocks Bob
      Then The Custom Game remains active
      And Neither person has won the Custom Game
