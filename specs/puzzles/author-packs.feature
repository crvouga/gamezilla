@domain:puzzles
Feature: Author ordered puzzle packs
  When Alice gathers puzzles into a pack, she wants one consistent builder, so she can arrange and publish a collection for any puzzle game.

  Rule: A pack keeps an ordered collection of distinct puzzles of its game

    Scenario: A new pack keeps its title and description
      Given Alice has chosen a game offering puzzle creation
      When Alice creates the pack draft "Rivers" describing "A gentle beginning"
      Then Alice has a private pack draft "Rivers" describing "A gentle beginning"

    Scenario: Adding a published puzzle appends it to the pack
      Given Alice owns the pack draft "Rivers" containing "River"
      And "Valley" is a published puzzle of that game
      When Alice adds "Valley" to the pack draft
      Then the pack draft contains "River, Valley" in that order

    Scenario: A puzzle of another game cannot enter the pack
      Given Alice owns the pack draft "Rivers" containing "River"
      And "Harbor" is a published puzzle of another game
      When Alice adds "Harbor" to the pack draft
      Then Alice is told pack puzzles must belong to the same game
      And the pack draft contains only "River"

    Scenario: Adding the same puzzle twice keeps one place for it
      Given Alice owns the pack draft "Rivers" containing "River"
      When Alice adds "River" to the pack draft
      Then Alice is told that puzzle is already in the pack
      And the pack draft contains only "River"

  Rule: Reordering or removing puzzles changes only the working pack
    No counter-example: publication, rather than an edit, replaces the public collection.

    Scenario: A later puzzle can be moved ahead of an earlier one
      Given Alice owns the pack draft "Rivers" containing "River, Valley, Harbor"
      When Alice moves "Harbor" before "River" in the pack draft
      Then the pack draft contains "Harbor, River, Valley" in that order

    Scenario: Removing a puzzle retains the order of the others
      Given Alice owns the pack draft "Rivers" containing "River, Valley, Harbor"
      When Alice removes "Valley" from the pack draft
      Then the pack draft contains "River, Harbor" in that order

  Rule: A new puzzle can be authored from its pack
    No counter-example: the pack still requires that puzzle to be published before the pack is published.

    Scenario: A new puzzle draft appears in the working pack
      Given Alice owns the pack draft "Rivers" containing "River"
      When Alice creates the puzzle draft "Valley" from that pack
      Then Alice can edit the puzzle draft "Valley"
      And the pack draft contains "River, Valley" in that order

  Rule: Different pack edits from two devices remain separate choices
    No counter-example: retaining both complete orders avoids silently mixing them.

    Scenario: Two different saved pack orders both remain available
      Given Alice's phone and tablet had the pack draft "Rivers" containing "River, Valley, Harbor"
      And Alice has saved the pack order "Harbor, River, Valley" on her phone
      When Alice saves the pack order "Valley, River, Harbor" from her tablet's earlier draft
      Then Alice can choose either saved pack order
      And Alice is told both draft copies were kept
