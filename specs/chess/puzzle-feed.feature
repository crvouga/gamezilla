@domain:chess
Feature: Customize the puzzle feed
  When a solver wants harder or easier puzzles, or puzzles they have played
  before, they want to customize the feed by its target and its history
  filter, so every puzzle suits them. A saved choice shows everywhere the feed
  is described, and it sticks.

  A new solver's automatic target is the 1500 seed rating, and the rating
  offset moves in steps of 50.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: A new solver's feed serves unseen puzzles at their seed rating
    Then Alice's feed history shows "Unseen"
    And Alice's feed targets 1500 automatically

  Scenario: A saved history filter shows on the feed
    When Alice changes the feed history to "Any" and saves the feed settings
    Then Alice's feed history shows "Any"
    And Alice has a puzzle on the board

  Scenario: Raising the rating offset previews the new target before saving
    Given Alice is editing the feed settings
    When Alice raises the feed rating offset by 2 steps
    Then Alice's feed rating offset is 100
    And Alice's unsaved feed settings preview a target of 1600

  Scenario: A saved rating offset moves the feed's target
    When Alice raises the feed rating offset by 2 steps and saves the feed settings
    Then Alice's feed targets 1600 automatically
    And Alice has a puzzle on the board

  Scenario: A custom target replaces the automatic one
    When Alice switches the feed to a custom target raised by 1 step and saves the feed settings
    Then Alice's feed targets a custom 1550

  Scenario: Reopening the feed settings keeps the custom target
    Given Alice has saved a custom feed target raised by 1 step
    When Alice starts editing the feed settings
    Then Alice's unsaved feed settings preview a target of 1550

  Scenario: The feed settings show how many puzzles fit the target
    Given Alice has saved a custom feed target raised by 1 step
    When Alice starts editing the feed settings
    Then Alice's feed settings show a pool of at least one matching puzzle

  Scenario: A custom target changes the rating window the puzzle is chosen from
    When Alice switches the feed to a custom target raised by 2 steps and saves the feed settings
    Then Alice's feed targets a custom 1600
    And Alice is solving a puzzle rated between 1100 and 1700
    And Alice is solving a different puzzle than the one before
