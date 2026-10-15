@domain:journeys
Feature: Play Connect Four with another person
  When Alice and Bob want a game together, they want to find each other and play Connect Four, so both see the same finished game.

  Rule: Two people can find each other and finish Connect Four
    No counter-example: refusals and interrupted play are covered by the Connect Four rules.

    Scenario: Two people share the completed game
      When Alice and Bob play Connect Four from fresh devices
      Then Alice and Bob see the same completed Connect Four game
