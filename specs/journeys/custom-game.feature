@domain:journeys
Feature: A guest plays a Custom Game against a bot
  When a guest wants to play chess, they want to choose a bot in their space, so a complete game needs neither an account nor a second person.

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
    Scenario: An offline guest cannot start the ready game
      Given a person opens the app on a fresh device
      And they are hosting a space
      And they have a ready Custom Game against a bot
      And the device is offline
      When they start the Custom Game
      Then they are told Custom Games need a connection
      And their Custom Game has not started
