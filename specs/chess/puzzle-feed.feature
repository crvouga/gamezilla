@domain:chess
Feature: Customize the puzzle feed
  When a solver wants harder or easier puzzles, or puzzles they have played
  before, they want to customize the feed by its target and its history
  filter, so every puzzle suits them. A saved choice shows everywhere the feed
  is described, and it sticks.

  A new solver's automatic target is the 1500 seed rating, and the rating
  offset moves in steps of 50.

  Rule: Feed settings choose the history filter and feed target for the next puzzle
    No counter-example: Every permitted choice defines the feed; the account requirement has its own refusal rule.

    Background:
      Given Alice is signed in

    Scenario: A new solver's feed serves unseen puzzles at their seed rating
      Given Alice is hosting a space
      When Alice opens puzzles in their space
      Then Alice's feed history shows "Unseen"
      And Alice's feed targets 1500 automatically

    Scenario: A saved history filter shows on the feed
      Given Alice is playing puzzles in their space
      And Alice has chosen "Any" for the unsaved feed history
      When Alice saves the feed settings
      Then Alice's feed history shows "Any"
      And Alice has a puzzle on the board

    Scenario: Raising the rating offset previews the new target before saving
      Given Alice is playing puzzles in their space
      And Alice is editing the feed settings
      When Alice raises the feed rating offset by 2 steps
      Then Alice's feed rating offset is 100
      And Alice's unsaved feed settings preview a target of 1600

    Scenario: A custom target replaces the automatic one
      Given Alice is playing puzzles in their space
      And Alice has chosen an unsaved custom feed target raised by 1 step
      When Alice saves the feed settings
      Then Alice's feed targets a custom 1550

    Scenario: Reopening the feed settings keeps the custom target
      Given Alice is playing puzzles in their space
      And Alice has saved a custom feed target raised by 1 step
      When Alice starts editing the feed settings
      Then Alice's unsaved feed settings preview a target of 1550

    Scenario: The feed settings show how many puzzles fit the target
      Given Alice is playing puzzles in their space
      And Alice has saved a custom feed target raised by 1 step
      When Alice starts editing the feed settings
      Then Alice's feed settings show a pool of at least one matching puzzle

    Scenario: A custom target changes the rating window the puzzle is chosen from
      Given Alice is playing puzzles in their space
      And Alice has chosen an unsaved custom feed target raised by 2 steps
      When Alice saves the feed settings
      Then Alice's feed targets a custom 1600
      And Alice is solving a puzzle rated between 1100 and 1700
      And Alice is solving a different puzzle than the one before

  Rule: Saving applies the previewed choices; closing without saving keeps the saved choices

    @regression:puzzle-feed-draft-auto-advance
    Scenario: Saving keeps a previewed auto-advance choice
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has chosen unsaved auto-advance after one second
      When Alice saves the feed settings
      Then Alice's saved feed advances after one second

    Scenario: A saved rating offset moves the feed's target
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has raised the unsaved feed rating offset by 2 steps
      When Alice saves the feed settings
      Then Alice's feed targets 1600 automatically
      And Alice has a puzzle on the board

    @regression:puzzle-feed-unsaved-choice-persists
    Scenario: Closing without saving discards the previewed offset
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has raised the unsaved feed rating offset by 2 steps
      When Alice closes the feed settings without saving
      Then Alice's feed targets 1500 automatically
      And Alice's unsaved choices cannot replace saved feed choices without saving

    Scenario: Reopening the app discards an unfinished feed edit
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has raised the unsaved feed rating offset by 2 steps
      When Alice reopens the app on the puzzle
      Then Alice's feed targets 1500 automatically
      And Alice's unsaved choices cannot replace saved feed choices without saving
