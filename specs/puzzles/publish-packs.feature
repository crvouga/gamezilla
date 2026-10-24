@domain:puzzles
Feature: Publish packs with stable puzzle editions
  When Alice publishes a pack, she wants its chosen puzzles and order to stay fixed, so people can finish the collection they started.

  Rule: An author publishes a nonempty pack of available published puzzles of one game

    Scenario: A valid pack becomes discoverable with its ordered puzzles
      Given Alice owns the pack draft "Rivers" containing "River, Valley"
      When Alice publishes her pack draft
      Then Bob can discover the pack "Rivers" with "River, Valley" in that order

    Scenario: An unpublished puzzle prevents pack publication
      Given Alice owns the pack draft "Rivers" containing her unpublished puzzle "River"
      When Alice publishes her pack draft
      Then Alice is told to publish the pack's puzzles first
      And Bob cannot discover the pack "Rivers"

    Scenario: A withdrawn puzzle cannot enter a newly published pack
      Given Alice owns the pack draft "Rivers" containing the withdrawn puzzle "River"
      When Alice publishes her pack draft
      Then Alice is told a pack puzzle is no longer available
      And Bob cannot discover the pack "Rivers"

    Scenario: An empty pack remains a draft
      Given Alice owns the empty pack draft "Rivers"
      When Alice publishes her pack draft
      Then Alice is told to add a puzzle before publishing the pack
      And Bob cannot discover the pack "Rivers"

    Scenario: Another person cannot publish the author's private pack
      Given Alice owns the pack draft "Rivers" containing "River, Valley"
      When Bob publishes Alice's pack draft
      Then Bob is told only the author may change that pack
      And Bob cannot discover the pack "Rivers"

  Rule: A published pack keeps its chosen puzzle editions
    No counter-example: updating a pack's chosen edition requires publishing a new pack edition.

    Scenario: An earlier pack stays unchanged when its puzzle is revised
      Given Alice has published the pack "Rivers" containing "River"
      And Alice has a valid working draft titled "Valley"
      When Alice publishes her puzzle draft
      Then Bob's published pack still offers the puzzle edition "River"
      And Bob can discover the published puzzle "Valley"

    Scenario: Withdrawing a puzzle keeps its earlier published pack playable
      Given Alice has published the pack "Rivers" containing "River"
      When Alice withdraws the puzzle "River"
      Then Bob's published pack still offers the puzzle edition "River"
      And Bob cannot discover the puzzle "River"

    Scenario: Publishing a pack keeps the puzzle edition chosen in its draft
      Given Alice owns the pack draft "Rivers" containing "River"
      And the pack's puzzle "River" now has a published edition "Valley"
      When Alice publishes her pack draft
      Then Bob can discover the pack "Rivers" with "River" in that order
      And Bob can discover the published puzzle "Valley"

  Rule: A published pack's draft can be changed independently
    No counter-example: keeping the public order is the purpose of a working draft.

    Scenario: The published pack stays unchanged when its working draft is reordered
      Given Alice has published the pack "Rivers" containing "River, Valley"
      When Alice moves "Valley" before "River" in the pack draft
      Then Bob's published pack contains "River, Valley" in that order
      And the pack draft contains "Valley, River" in that order

    Scenario: Republishing the pack makes the new order current
      Given Alice has published the pack "Rivers" containing "River, Valley"
      And Alice has a valid working pack draft containing "Valley, River"
      When Alice publishes her pack draft
      Then Bob can discover the pack "Rivers" with "Valley, River" in that order
      And Alice can still inspect the earlier pack edition

  Rule: Only the author withdraws a pack and saved attempts remain available

    Scenario: Withdrawing a pack hides it without erasing a saved attempt
      Given Bob has a saved attempt from Alice's published pack "Rivers"
      When Alice withdraws the pack "Rivers"
      Then Bob cannot discover the pack "Rivers"
      And Bob can resume that saved attempt

    Scenario: Another person cannot withdraw the author's public pack
      Given Alice has published the pack "Rivers" containing "River, Valley"
      When Bob withdraws Alice's pack "Rivers"
      Then Bob is told only the author may change that pack
      And Bob can discover the pack "Rivers" with "River, Valley" in that order

  Rule: Publishing the same saved pack draft again keeps one edition
    No counter-example: a newly saved pack draft is a different publication choice.

    Scenario: Repeated pack publication keeps one edition
      Given Alice has published the pack "Rivers" containing "River, Valley"
      When Alice publishes her pack draft
      Then Alice sees one published pack edition of "Rivers"

    Scenario: An earlier pack publication cannot replace a later order
      Given Alice has published the pack "Rivers" containing "River, Valley"
      And Alice has published a later pack edition containing "Valley, River"
      When Alice publishes the earlier saved pack draft containing "River, Valley" again
      Then Bob can discover the pack "Rivers" with "Valley, River" in that order

    Scenario: Repeating pack publication cannot undo withdrawal
      Given Alice has published the pack "Rivers" containing "River, Valley"
      And Alice has withdrawn the pack "Rivers"
      When Alice publishes her pack draft
      Then Bob cannot discover the pack "Rivers"
      And Alice sees one published pack edition of "Rivers"
