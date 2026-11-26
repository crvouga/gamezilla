@domain:journeys
Feature: Going back from a Classic Quoridor game
  Alice can keep playing when she changes her mind about resigning. Once she resigns she returns to where she chose to play.

  Rule: Going back only ends play when the player confirms

    @regression:game-stage-back-minimizes-space
    Scenario: Alice keeps playing against the bot before deciding to resign
      Given Alice starts "Classic Quoridor" with bots from a fresh device
      And Alice goes back from playing Classic Quoridor and is asked whether to resign
      When Alice decides to keep playing Classic Quoridor
      Then Alice moves to e2 and sees the bot reply
      When Alice goes back from playing Classic Quoridor and is asked whether to resign
      And Alice confirms she wants to resign and go back
      Then Alice sees the game choices in the same space
