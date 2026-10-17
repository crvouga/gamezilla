@domain:chess
Feature: Hear an earlier position of a multiplayer game by its move
  When a person listening to the app reviews their multiplayer game, they want to hear which move the earlier position follows, so they know where in the game they are without seeing the board.

  Rule: A person listening to the app is told which earlier position they are reviewing, by its move in algebraic notation
    No counter-example: descriptions are always present for a person listening to the app.

    Scenario: A person listening to the app hears which earlier position they are reviewing
      Given Alice is listening to her 5+0 multiplayer game with Bob after e4 and e5
      When Alice chooses e4 in the multiplayer move list
      Then Alice hears she is reviewing the earlier position after e4 in the multiplayer game
