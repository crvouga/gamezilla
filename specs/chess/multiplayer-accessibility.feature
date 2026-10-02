@domain:chess
Feature: Play multiplayer chess without a mouse or sight
  When a person uses only the keyboard or listens to the app, they want to
  find an opponent and play chess, so every multiplayer action is available.

  Rule: Multiplayer chess works with the keyboard alone
    No counter-example: keyboard access is always available, regardless of a game's result.

    Scenario: A person using the keyboard can seek an opponent
      Given Alice has an account and is using the keyboard alone
      When Alice finds a chess opponent with the keyboard
      Then Alice is looking for a chess opponent

    Scenario: A person using the keyboard can move a piece and resign
      Given Alice is White in a new multiplayer game and is using the keyboard alone
      When Alice plays e2 to e4 as a multiplayer move with the keyboard
      Then Bob has the multiplayer turn
      And Alice can resign multiplayer chess with the keyboard

  Rule: A listener hears the game, turn, moves and result
    No counter-example: descriptions and announcements are always present for a listener.

    Scenario: A listener hears their side and the person whose turn it is
      Given Alice is White in a new multiplayer game and is listening to the app
      When Alice opens multiplayer chess
      Then Alice hears she is White and has the multiplayer turn
      And Alice hears what every multiplayer control does

    Scenario: A listener hears an accepted multiplayer result
      Given Alice is listening to her unfinished multiplayer game with Bob
      When Bob resigns multiplayer chess
      Then Alice hears she won the multiplayer game
