@domain:journeys
Feature: Return to an unfinished custom game before starting Pong
  A host who changes games can finish setting up the earlier game or cancel it and play the game they chose.

  Rule: Reopening the space keeps the unfinished game and its seats

    @regression:custom-game-hidden-by-game-choice
    Scenario: A host reopens Quoridor setup from Pong and then plays Pong against a bot
      Given a person opens the app on a fresh device
      And they are hosting a space
      When they set up Quoridor with an open second seat
      And they choose Pong and reopen their space
      Then they see the Quoridor seats and can cancel that game
      When they ask to cancel Quoridor
      And they confirm the cancellation
      Then they can start Pong against a bot
      When they choose to play the Pong bot
      Then they see their paddle on the Pong court
