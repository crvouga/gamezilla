@domain:chess
Feature: Custom Games with the keyboard and by listening
  When someone uses the keyboard alone or listens to the app, they want to choose sides and play chess, so Custom Games remain available to them.

  Rule: The keyboard alone can choose a participant and start a ready game
    No counter-example: the keyboard is a way to perform the same choices; all refusals remain the same.

    Scenario: A creator chooses a bot with the keyboard alone
      Given Alice has a configuring Custom Game
      When Alice assigns a bot to Black in the Custom Game with the keyboard alone
      Then Black is a bot in the Custom Game

    Scenario: A creator starts with the keyboard alone
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      When Alice starts the Custom Game with the keyboard alone
      Then The Custom Game is active with White to move

  Rule: Listening describes the sides, readiness and outcome
    No counter-example: descriptions belong to the choices and result, and nobody can take them away.

    Scenario: The choices are described to a person listening
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is a bot
      When Alice listens to the Custom Game
      Then Alice hears White is Alice and Black is a bot
      And Alice hears whether the Custom Game can start

    Scenario: The completed outcome is described to a person listening
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      When Alice listens to the Custom Game
      Then Alice hears the Custom Game's completed outcome
