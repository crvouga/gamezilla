@domain:sokoban
Feature: Publish proven Sokoban puzzles
  When Alice publishes a Sokoban puzzle, she wants it published only after she has completed exactly that board herself, so everyone who plays it knows it can be completed.

  Background:
    Given Alice owns the Sokoban draft "First Steps" laid out as:
      |   | A    | B      | C     | D    | E    |
      | 1 | wall | wall   | wall  | wall | wall |
      | 2 | wall | worker | crate | goal | wall |
      | 3 | wall | wall   | wall  | wall | wall |

  Rule: A Sokoban puzzle is published only after its author completed a playtest of exactly that board

    Scenario: A board completed in a playtest can be published
      Given Alice has completed a playtest of her Sokoban draft
      When Alice publishes her puzzle draft
      Then Bob can play the Sokoban puzzle "First Steps"

    Scenario: A board never playtested cannot be published
      When Alice publishes her puzzle draft
      Then Alice is told to complete a playtest of this board before publication
      And Bob cannot play the Sokoban puzzle "First Steps"

    Scenario: A playtest stopped before completion is not proof
      Given Alice has stopped a playtest of her Sokoban draft before completing it
      When Alice publishes her puzzle draft
      Then Alice is told to complete a playtest of this board before publication
      And Bob cannot play the Sokoban puzzle "First Steps"

  Rule: Completing a playtest proves the board without counting as ordinary completion
    No counter-example: a playtest is private practice; one stopped early proves nothing, as the first rule shows.

    Scenario: Beginning a playtest plays the private draft
      When Alice playtests her puzzle draft
      Then Alice can play the private draft "First Steps"
      And Alice sees her Sokoban board is not proven

    Scenario: Completing a playtest proves the board
      Given Alice is playtesting her Sokoban draft
      When Alice completes that playtest
      Then Alice sees her Sokoban board is proven
      And Alice has no ordinary completion for "First Steps"

    Scenario: Stopping a playtest before completion keeps the board unproven
      Given Alice is playtesting her Sokoban draft
      When Alice stops her playtest before it is complete
      Then Alice sees her Sokoban board is not proven

    Scenario: A stopped playtest can be begun again
      Given Alice has stopped a playtest of her Sokoban draft before completing it
      When Alice playtests her puzzle draft
      Then Alice can play the private draft "First Steps"

    Scenario: Playtesting a proven board again keeps its proof
      Given Alice has completed a playtest of her Sokoban draft
      When Alice playtests her puzzle draft
      Then Alice can play the private draft "First Steps"
      And Alice sees her Sokoban board is proven

  Rule: A board edit needs a new completed playtest, while changing only the details keeps the proof

    Scenario: A board edit after a playtest takes away the proof
      Given Alice has completed a playtest of her Sokoban draft
      When Alice edits the board by painting "A1" as outside
      Then Alice sees her Sokoban board is not proven

    Scenario: A board edited after its playtest cannot be published
      Given Alice has completed a playtest of her Sokoban draft and since edited the board by painting "A1" as outside
      When Alice publishes her puzzle draft
      Then Alice is told to complete a playtest of this board before publication

    Scenario: Changing only the details keeps the proof
      Given Alice has completed a playtest of her Sokoban draft
      When Alice changes only the details of her Sokoban draft, renaming it "Gentle Start"
      Then Alice sees her Sokoban board is proven

    Scenario: Editing the board of a published puzzle keeps the published puzzle as it was
      Given Alice has published her playtested Sokoban draft
      When Alice edits the board by painting "A1" as outside
      Then Bob can still play the Sokoban puzzle "First Steps" as published

    Scenario: An edited board playtested again can be published
      Given Alice has completed a playtest of her Sokoban draft, edited the board by painting "A1" as outside and completed another playtest
      When Alice publishes her puzzle draft
      Then Bob can play the Sokoban puzzle "First Steps"

  Rule: A playtest completed before a rules change is no longer proof

    Scenario: A rules change takes away a playtested board's proof
      Given Alice has completed a playtest of her Sokoban draft
      When Sokoban's rules change
      Then Alice sees her Sokoban board is not proven

    Scenario: A playtest from before a rules change cannot publish the board
      Given Alice has completed a playtest of her Sokoban draft before Sokoban's rules changed
      When Alice publishes her puzzle draft
      Then Alice is told to complete a playtest of this board before publication
      And Bob cannot play the Sokoban puzzle "First Steps"

    Scenario: A playtest completed under the changed rules publishes the board
      Given Alice has completed a playtest of her Sokoban draft before Sokoban's rules changed and another since
      When Alice publishes her puzzle draft
      Then Bob can play the Sokoban puzzle "First Steps"

  Rule: Publication waits for a connection, while building and playtesting work without one

    Scenario: A playtest can be completed offline
      Given Alice is playtesting her Sokoban draft on her offline phone
      When Alice completes that playtest
      Then Alice sees her Sokoban board is proven

    Scenario: A proven board chosen for publication offline waits for the connection
      Given Alice has completed a playtest of her Sokoban draft on her offline phone
      When Alice publishes her puzzle draft
      Then Alice is told publication waits for her connection
      And Bob cannot play the Sokoban puzzle "First Steps"

    Scenario: Publishing again while waiting keeps the publication waiting
      Given Alice has chosen to publish her playtested Sokoban draft on her offline phone
      When Alice publishes her puzzle draft
      Then Alice is told publication waits for her connection

    Scenario: A waiting publication goes ahead when the connection returns
      Given Alice has chosen to publish her playtested Sokoban draft on her offline phone
      When Alice's phone is back online
      Then Bob can play the Sokoban puzzle "First Steps"
