@domain:journeys
Feature: Play a custom game in a space
  When someone wants to play chess in their space, they want a bot or someone who joined from the link as their opponent, so a complete game is played and finished without needing an account.

  Rule: A guest can choose a bot, play and finish the same custom game

    @regression:custom-game-journey-unbound
    @regression:custom-game-confirm-unmounted
    Scenario: A guest plays a move against a bot and resigns
      Given a person opens the app on a fresh device
      And they are hosting a space
      When they start a custom game against a bot
      Then their custom game board is ready for White
      When they play e2-e4 in the custom game
      Then a legal bot reply returns White's turn
      When they resign the custom game
      Then their custom game is completed by resignation

    @regression:custom-game-journey-unbound
    @regression:custom-game-journey-offline-race
    Scenario: An offline guest starts the ready game against a bot
      Given a person opens the app on a fresh device
      And they are hosting a space
      And they have a ready custom game against a bot
      And the device is offline
      When they start the custom game
      Then their custom game board is ready for White

  Rule: Two people in one space can agree on sides, play and finish the same custom game

    Scenario: Someone who joined from the link accepts an invitation and becomes ready
      Given Alice is hosting a space that Bob joined from the link
      When Alice invites Bob to Black in a new custom game
      Then Bob sees Alice's invitation to play Black
      When Bob accepts Black in the custom game
      Then Black is Bob in the custom game
      When Alice and Bob become ready for the custom game
      Then The custom game is startable

    Scenario: Two people play a move and finish by resignation
      Given Alice is hosting a space that Bob joined from the link
      And Alice and Bob are ready for a custom game with Bob as Black
      When Alice starts the custom game
      Then Bob's board faces Black
      When Alice plays e2-e4 in the custom game
      Then Bob sees e4 in the custom game move list
      When Bob resigns the custom game
      Then both people see Alice wins the custom game by resignation
