@domain:journeys
Feature: Return to a Classic Quoridor game from the lobby
  When Alice steps away from her board, she wants to find her space in the lobby and continue from the move she just played.

  Rule: Minimizing a space keeps its game under way

    @regression:space-bar-actions-hidden
    Scenario: The host returns to the same board after the bot replies
      Given Alice is playing Classic Quoridor against a bot on a fresh device
      When Alice moves to e2 and sees the bot reply
      When Alice minimizes her space
      Then Alice sees her space in the lobby
      When Alice opens that space from the lobby
      Then Alice sees the same board and turn in her Classic Quoridor game
