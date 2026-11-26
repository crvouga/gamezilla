@domain:journeys
Feature: Return to an unfinished custom game before starting Pong
  A host who changes games can finish setting up the earlier game or cancel it and play the game they chose.

  Rule: Reopening the space keeps the unfinished game and its seats

    @regression:custom-game-hidden-by-game-choice
    Scenario: A host reopens Quoridor setup from Pong and then plays Pong against a bot
      Given a host has set up Quoridor with an open second seat on a fresh device
      When they choose Pong and reopen their space
      Then they see the Quoridor seats and can cancel that game
      When they ask to cancel Quoridor
      And they confirm the cancellation
      Then they can start Pong against a bot
      And choosing the Pong bot brings them to their paddle on the court
