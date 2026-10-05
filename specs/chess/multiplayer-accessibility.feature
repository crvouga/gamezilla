@domain:chess
Feature: Play multiplayer chess without a mouse or sight
  When a person uses only the keyboard or listens to the app, they want to
  find a chess opponent and play, so every multiplayer action is available.

  Rule: Multiplayer chess works with the keyboard alone
    No counter-example: keyboard access is always available, regardless of a game's multiplayer result.

    Scenario: A person using the keyboard can seek a chess opponent
      Given Alice has an account and is using the keyboard alone
      When Alice finds a chess opponent for 5+0 with the keyboard
      Then Alice is looking for a chess opponent

    Scenario: A person using the keyboard can move a piece and resign
      Given Alice is White after e4 and e5 in a 5+0 multiplayer game and is using the keyboard alone
      When Alice plays g1 to f3 as a multiplayer move with the keyboard
      Then Bob has the multiplayer turn
      And Alice can resign multiplayer chess with the keyboard

    Scenario: A person using the keyboard can abort a new game
      Given Alice is White in a new multiplayer game and is using the keyboard alone
      When Alice aborts the multiplayer game with the keyboard
      Then both people see the multiplayer game was aborted

    Scenario: A person using the keyboard can offer a multiplayer draw
      Given Alice is White in a new multiplayer game and is using the keyboard alone
      When Alice offers a multiplayer draw with the keyboard
      Then Bob is offered a multiplayer draw

    Scenario: A person using the keyboard can offer a multiplayer rematch
      Given Alice is using the keyboard alone after her 5+0 multiplayer game with Bob is over
      When Alice offers a multiplayer rematch with the keyboard
      Then Bob is offered a multiplayer rematch

  Rule: A listener hears who they were matched with, the game, both multiplayer clocks, offers and the multiplayer result
    No counter-example: descriptions and announcements are always present for a listener.

    Scenario: A listener hears who they were matched with
      Given Alice is listening to the app while looking for a 3+2 chess opponent
      When a matchmaking match is formed for Alice and Bob
      Then Alice hears she was matched with Bob, his blitz rating, the time control and her colour

    Scenario: A listener hears their side and the person whose turn it is
      Given Alice is White in a new multiplayer game and is listening to the app
      When Alice opens multiplayer chess
      Then Alice hears she is White and has the multiplayer turn
      And Alice hears what every multiplayer control does

    Scenario: A listener hears the time left on both multiplayer clocks
      Given Alice is listening to her unfinished multiplayer game with Bob
      When Alice opens multiplayer chess
      Then Alice hears the time left on both multiplayer clocks

    Scenario: A listener hears a multiplayer draw offer
      Given Alice is listening to her unfinished multiplayer game with Bob
      When Bob offers a multiplayer draw
      Then Alice hears Bob offered her a multiplayer draw

    Scenario: A listener hears that the game was aborted
      Given Alice is White in a new multiplayer game and is listening to the app
      When Bob aborts the multiplayer game
      Then Alice hears the multiplayer game was aborted

    Scenario: A listener hears a multiplayer rematch offer
      Given Alice is listening to the app after her 5+0 multiplayer game with Bob is over
      When Bob offers a multiplayer rematch
      Then Alice hears Bob offered her a multiplayer rematch

    Scenario: A listener hears an accepted multiplayer result
      Given Alice is listening to her 5+0 multiplayer game with Bob after e4 and e5
      When Bob resigns multiplayer chess
      Then Alice hears she won the multiplayer game
