@domain:journeys
Feature: Play a Custom Game in a space
  When someone wants to play chess in their space, they want a bot or someone who joined from the link as their opponent, so a complete game is played and finished without needing an account.

  Rule: A guest can choose a bot, play and finish the same Custom Game

    @regression:custom-game-journey-unbound
    @regression:custom-game-confirm-unmounted
    Scenario: A guest plays a move against a bot and resigns
      Given a person opens the app on a fresh device
      And they are hosting a space
      When they start a Custom Game against a bot
      Then their Custom Game board is ready for White
      When they play e2-e4 in the Custom Game
      Then a legal bot reply returns White's turn
      When they resign the Custom Game
      Then their Custom Game is completed by resignation

    @regression:custom-game-journey-unbound
    @regression:custom-game-journey-offline-race
    Scenario: An offline guest starts the ready game against a bot
      Given a person opens the app on a fresh device
      And they are hosting a space
      And they have a ready Custom Game against a bot
      And the device is offline
      When they start the Custom Game
      Then their Custom Game board is ready for White

  Rule: Two people in one space can agree on sides, play and finish the same Custom Game

    Scenario: Someone who joined from the link accepts an invitation and becomes ready
      Given Alice is hosting a space that Bob joined from the link
      When Alice invites Bob to Black in a new Custom Game
      Then Bob sees Alice's invitation to play Black
      When Bob accepts Black in the Custom Game
      Then Black is Bob in the Custom Game
      When Alice and Bob become ready for the Custom Game
      Then The Custom Game is startable

    Scenario: Two people play a move and finish by resignation
      Given Alice is hosting a space that Bob joined from the link
      And Alice and Bob are ready for a Custom Game with Bob as Black
      When Alice starts the Custom Game
      Then Bob's board faces Black
      When Alice plays e2-e4 in the Custom Game
      Then Bob sees e4 in the Custom Game move list
      When Bob resigns the Custom Game
      Then both people see Alice wins the Custom Game by resignation
