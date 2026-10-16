@domain:games
Feature: History and review of every game
  When Alice finishes a game, she wants its history and every move reviewable the same way in every game, so each result stays understandable.

  Rule: Review shows a played move without changing the game

    Scenario: A played move can be reviewed
      Given Alice has a finished custom game
      When Alice reviews the third move
      Then Alice sees the board after three moves
      And the finished custom game is unchanged

    Scenario: A move that was not played cannot be reviewed
      Given Alice has a finished custom game
      When Alice reviews a move that was not played
      Then Alice is told that move was not played

  Rule: A game's statistics count that game alone

    Scenario: A victory counts in the game's statistics
      Given Alice has won a custom game
      When Alice opens the game's history
      Then Alice sees her victory and its participants

    Scenario: A victory in another game is not counted in this game's statistics
      Given Alice has won a custom game of another game
      When Alice opens the game's history
      Then Alice sees no victories
