@domain:games
Feature: Custom games leave the puzzle rating alone
  When a person who plays puzzles of the game plays a custom game, they want
  their puzzle rating left as it was, so other play never disturbs their
  puzzles. It holds for every game that offers puzzles as well as custom
  games.

  Rule: A custom game never changes a puzzle rating
    No counter-example: nothing played in a custom game reaches a puzzle rating.

    Scenario: A custom game cannot change the puzzle rating
      Given Alice and Bob have a custom game under way
      When Alice resigns the custom game
      Then Bob wins the custom game by resignation
      And Alice's puzzle rating is 1500
