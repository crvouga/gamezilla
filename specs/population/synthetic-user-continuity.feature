@domain:population
Feature: Synthetic Users recover their current activity
  When a Synthetic User's app reopens, people want it to recover its current
  activity, so an interruption never takes away their ongoing game.

  Rule: Recovery keeps a Synthetic User's identity
    No counter-example: reopening never gives a Synthetic User a different account.

    Scenario: An available Synthetic User keeps its identity after reopening
      Given the Synthetic User "Cedar" is available
      When the Synthetic User "Cedar" closes and reopens the app
      Then the Synthetic User "Cedar" keeps its account and username
      And the Synthetic User "Cedar" remains available

  Rule: Recovery preserves an ongoing game
    No counter-example: every ongoing game must survive reopening.

    Scenario: A Synthetic User returns to its ongoing game
      Given the Synthetic User "Cedar" has an ongoing game
      When the Synthetic User "Cedar" closes and reopens the app
      Then the Synthetic User "Cedar" keeps its account and username
      And the Synthetic User "Cedar" continues its same multiplayer game

  Rule: Recovery preserves a finished multiplayer result
    No counter-example: reopening never makes a finished game ongoing again.

    Scenario: A Synthetic User keeps its finished game after reopening
      Given the Synthetic User "Cedar" has a finished multiplayer game
      When the Synthetic User "Cedar" closes and reopens the app
      Then the Synthetic User "Cedar" keeps its account and username
      And the Synthetic User "Cedar" keeps its finished multiplayer result
