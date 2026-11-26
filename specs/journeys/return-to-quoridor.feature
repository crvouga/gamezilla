@domain:journeys
Feature: Return to a Classic Quoridor game from the lobby
  When Alice steps away from her board, she wants to find her space in the lobby and continue from the move she just played.

  Rule: Minimizing a space keeps its game under way

    @regression:space-bar-actions-hidden
    Scenario: The host returns to the same board after the bot replies
      Given Alice has played e2 in Classic Quoridor on a fresh device and the bot has replied
      When Alice minimizes her space
      Then Alice sees her space in the lobby
      When Alice opens that space from the lobby
      Then Alice sees the same board and turn in her Classic Quoridor game

    Scenario: The host manages the space and comes back to the board
      Given Alice has played e2 in Classic Quoridor on a fresh device and the bot has replied
      When Alice opens the people in her space
      Then Alice can share the space link from the same place
      When Alice opens her space settings
      Then Alice can change the space name and manage its people and sharing
      When Alice returns from settings to her board
      Then Alice sees the same board and turn in her Classic Quoridor game
