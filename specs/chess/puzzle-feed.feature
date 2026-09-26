@domain:chess @goal:chess-puzzles:3 @goal:chess-puzzles:4
Feature: Customize the puzzle feed
  The feed serves puzzles suited to the player's rating, and the player can
  customize it by history and by difficulty. A saved choice shows everywhere
  the feed is described, and it sticks.

  A new player's automatic target is the 1500 seed rating, and the rating
  offset moves in steps of 50.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: A history filter change shows everywhere once saved
    Then Alice's feed history shows "Unseen"
    When Alice changes the feed history to "Any" and saves the feed settings
    Then Alice's feed history shows "Any"
    And Alice has a puzzle on the board

  Scenario: A rating offset moves the target in the feed settings and on the feed
    Then Alice's feed targets 1500 automatically
    When Alice starts editing the feed settings
    Then Alice's feed rating offset is 0
    When Alice raises the feed rating offset by 2 steps
    Then Alice's feed rating offset is 100
    And Alice's unsaved feed settings preview a target of 1600
    When Alice saves the feed settings
    Then Alice's feed targets 1600 automatically
    And Alice has a puzzle on the board

  Scenario: A custom target replaces the automatic one and is still there on reopening the settings
    When Alice switches the feed to a custom target raised by 1 step and saves the feed settings
    Then Alice's feed targets a custom 1550
    When Alice starts editing the feed settings
    Then Alice's feed settings show a pool of at least one matching puzzle

  Scenario: A custom difficulty target changes the band the puzzle is chosen from
    When Alice switches the feed to a custom target raised by 2 steps and saves the feed settings
    Then Alice's feed targets a custom 1600
    And Alice is solving a puzzle rated between 1100 and 1700
    And Alice is solving a different puzzle than the one before
