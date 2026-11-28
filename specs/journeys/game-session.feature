@domain:journeys
Feature: Play a game session in a space
  When someone wants to play chess in their space, they want a bot or someone who joined from the link as their opponent, so a complete game is played and finished without needing an account.

  Rule: A guest can play as soon as their game session against a bot starts

    @regression:game-session-journey-unbound
    @regression:game-session-confirm-unmounted
    Scenario: A guest plays a move against a bot and resigns
      Given a person opens the app on a fresh device
      And they are hosting a space
      When they start a game session against a bot
      Then their game session board is ready for White
      When they play e2-e4 in the game session
      Then a legal bot reply returns White's turn
      When they resign the game session
      Then their game session is completed by resignation

    @regression:game-session-journey-unbound
    @regression:game-session-journey-offline-race
    Scenario: An offline guest starts the ready game against a bot
      Given a person opens the app on a fresh device
      And they are hosting a space
      And they have a ready game session against a bot
      And the device is offline
      When they start the game session
      Then their game session board is ready for White

  Rule: Once both people agree on their sides and the host starts, they go straight to the board

    Scenario: Someone who joined from the link accepts an invitation and becomes ready
      Given Alice is hosting a space that Bob joined from the link
      When Alice invites Bob to Black in a new game session
      Then Bob sees Alice's invitation to play Black
      When Bob accepts Black in the game session
      Then Black is Bob in the game session
      When Alice and Bob become ready for the game session
      Then The game session is startable

    Scenario: Two people play a move and finish by resignation
      Given Alice is hosting a space that Bob joined from the link
      And Alice and Bob are ready for a game session with Bob as Black
      When Alice starts the game session
      Then Bob's board faces Black
      When Alice plays e2-e4 in the game session
      Then Bob sees e4 in the game session move list
      When Bob resigns the game session
      Then both people see Alice wins the game session by resignation
