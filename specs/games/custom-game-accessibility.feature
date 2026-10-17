@domain:games
Feature: Custom games with the keyboard alone and by listening
  When someone uses the keyboard alone or listens to the app, they want to choose the sides and follow the custom game, so custom games stay open to them.

  Rule: The keyboard alone can choose a participant and start a ready custom game
    No counter-example: the keyboard is another way to make the same choices; every refusal stays the same.

    Scenario: A creator chooses a bot with the keyboard alone
      Given Alice is setting up a custom game
      When Alice assigns a bot to the second side with the keyboard alone
      Then the second side is a bot

    Scenario: A creator starts with the keyboard alone
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      When Alice starts the custom game with the keyboard alone
      Then Alice sees the custom game under way with the first side to move

  Rule: Listening describes the sides, readiness and result
    No counter-example: the descriptions belong to the choices and the result, and nobody can take them away.

    Scenario: The choices are described to a person listening
      Given Alice is setting up a custom game
      And Alice has assigned a bot to the second side
      When Alice listens to the custom game
      Then Alice hears the first side is Alice and the second side is a bot
      And Alice hears whether the custom game can start

    Scenario: The finished result is described to a person listening
      Given Alice has a finished custom game
      When Alice listens to the custom game
      Then Alice hears the custom game's result
