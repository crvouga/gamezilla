@domain:chess
Feature: Customize the puzzle feed
  When a solver wants harder or easier puzzles, a puzzle theme, or puzzles
  they have played before, they want to customize the feed, so every puzzle
  suits them.

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
      And Alice is served a puzzle rated between 1400 and 1800
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

  Rule: The rating offset stays between −400 and +400, and a custom feed target between 400 and 3000

    Background:
      Given Alice is signed in
      And Alice is playing puzzles in their space

    Scenario: Raising the rating offset to +400 previews a target 400 above the rating
      Given Alice is editing the feed settings
      When Alice raises the feed rating offset by 8 steps
      Then Alice's feed rating offset is 400
      And Alice's unsaved feed settings preview a target of 1900

    Scenario: Raising the rating offset past +400 is refused
      Given Alice has raised the unsaved feed rating offset by 8 steps
      When Alice raises the feed rating offset by 1 step
      Then Alice cannot raise the feed rating offset past 400
      And Alice's unsaved feed settings preview a target of 1900

    Scenario: Lowering the rating offset past −400 is refused
      Given Alice has lowered the unsaved feed rating offset by 8 steps
      When Alice lowers the feed rating offset by 1 step
      Then Alice cannot lower the feed rating offset past -400
      And Alice's unsaved feed settings preview a target of 1100

    Scenario: Raising a custom feed target to 3000 is allowed
      Given Alice has chosen an unsaved custom feed target raised by 29 steps
      When Alice raises the custom feed target by 1 step
      Then Alice's unsaved feed settings preview a target of 3000

    Scenario: Raising a custom feed target past 3000 is refused
      Given Alice has chosen an unsaved custom feed target raised by 30 steps
      When Alice raises the custom feed target by 1 step
      Then Alice cannot raise the custom feed target past 3000
      And Alice's unsaved feed settings preview a target of 3000

    Scenario: Lowering a custom feed target past 400 is refused
      Given Alice has chosen an unsaved custom feed target lowered by 22 steps
      When Alice lowers the custom feed target by 1 step
      Then Alice cannot lower the custom feed target past 400
      And Alice's unsaved feed settings preview a target of 400

  Rule: A chosen puzzle theme serves only puzzles with that theme

    Background:
      Given Alice is signed in
      And the puzzle pool holds puzzles with and without the "fork" theme
      And Alice is playing puzzles in their space

    Scenario: Choosing a theme serves a puzzle with that theme
      When Alice limits the feed to the "fork" theme
      Then Alice is served a puzzle with the "fork" theme

    Scenario: A puzzle without the chosen theme is not offered
      Given Alice has limited the feed to the "fork" theme
      And Alice has skipped the puzzle
      When Alice moves on to the next puzzle
      Then Alice is not offered a puzzle without the "fork" theme

  Rule: The "Failed" history filter serves only puzzles the solver failed, unrated

    Background:
      Given Alice is signed in
      And Alice is playing puzzles in their space

    Scenario: "Failed" brings back a failed puzzle, unrated
      Given Alice has solved 2 puzzles and failed 1
      And Alice has chosen "Failed" for the unsaved feed history
      When Alice saves the feed settings
      Then Alice is solving the puzzle they failed
      And Alice is told the attempt is unrated

    Scenario: "Failed" with no failed attempt leaves the feed empty and says why
      Given Alice has solved 2 puzzles in a row
      And Alice has chosen "Failed" for the unsaved feed history
      When Alice saves the feed settings
      Then Alice is told the feed is empty because they have no failed attempts
      And Alice has no puzzle on the board
