@domain:games
Feature: Game sessions leave the puzzle rating alone
  When a person who plays puzzles of the game plays a game session, they want
  their puzzle rating left as it was, so other play never disturbs their
  puzzles. It holds for every game that offers puzzles as well as game
  sessions.

  Rule: A game session never changes a puzzle rating
    No counter-example: nothing played in a game session reaches a puzzle rating.

    Scenario: A game session cannot change the puzzle rating
      Given Alice and Bob have a game session under way
      When Alice resigns the game session
      Then Bob wins the game session by resignation
      And Alice's puzzle rating is 1500
