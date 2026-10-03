@domain:chess
Feature: Choose White and Black
  When setting up a Custom Game, the creator wants to choose each side, so the same game accommodates people, bots and open places.

  Rule: The creator changes participants only before start

    Scenario: A bot replaces an open place
      Given Alice has a configuring Custom Game
      When Alice assigns a bot to Black in the Custom Game
      Then Black is a bot in the Custom Game

    Scenario: Starting freezes the participants
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice assigns a bot to Black in the Custom Game
      Then Alice is told the Custom Game has already started

  Rule: One person controls at most one side

    Scenario: The creator takes Black instead of White
      Given Alice has a configuring Custom Game
      And White in the Custom Game is an open place
      When Alice takes Black in the Custom Game
      Then Black is Alice in the Custom Game

    Scenario: The creator cannot take both sides
      Given Alice has a configuring Custom Game
      When Alice takes Black in the Custom Game
      Then Alice is told a person cannot take both sides

  Rule: A creator may watch two other participants

    Scenario: Two bots start under a watching creator
      Given Alice has a configuring Custom Game
      And White and Black in the Custom Game are bots
      When Alice starts the Custom Game
      Then Alice is watching the Custom Game
      And White and Black are bots in the active Custom Game

    Scenario: Watching does not grant control of a bot
      Given Alice has a configuring Custom Game
      And White and Black in the Custom Game are bots
      And The Custom Game has started
      When Alice plays e2-e4 in the Custom Game
      Then Alice is told only the participant to move may play

  Rule: Swapping sides requires people to become ready again

    Scenario: The creator swaps accepted people
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      When Alice swaps White and Black in the Custom Game
      Then White is Bob and Black is Alice in the Custom Game
      And Neither person is ready for the Custom Game

    Scenario: Active sides cannot swap
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice swaps White and Black in the Custom Game
      Then Alice is told the Custom Game has already started

  Rule: A closed side cannot be claimed

    Scenario: The creator closes an unoccupied side
      Given Alice has a configuring Custom Game
      When Alice closes Black in the Custom Game
      Then Black is closed in the Custom Game

    Scenario: A closed side refuses another person
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is closed
      When Bob claims Black in the Custom Game
      Then Bob is told that side is not an open place
