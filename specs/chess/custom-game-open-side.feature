@domain:chess
Feature: Open a side
  When the creator wants someone else to take a side, they want to open it, so its earlier choice no longer reserves the place.

  Rule: Opening a side removes its earlier choice before start

    Scenario: Opening a bot's side makes it available to a person
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is a bot
      When Alice opens Black in the Custom Game
      Then Black is an open place in the Custom Game

    Scenario: An active side cannot be opened
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice opens Black in the Custom Game
      Then Alice is told the Custom Game has already started
