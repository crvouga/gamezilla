@domain:puzzles
Feature: Publish packs with stable puzzle editions
  When Alice publishes a pack, she wants its chosen puzzles and order to stay fixed, so people can finish the collection they started.

  Rule: Every published pack contains available published puzzles of one game

    Scenario: A valid pack becomes discoverable with its ordered puzzles
      Given Alice owns a valid pack draft "Rivers" containing "River, Valley"
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

  Rule: A published pack keeps its chosen puzzle editions
    No counter-example: updating a pack's chosen edition requires publishing a new pack edition.

    Scenario: An earlier pack stays unchanged when its puzzle is revised
      Given Alice has published the pack "Rivers" choosing the puzzle edition "River"
      And Alice has a valid working puzzle draft titled "Valley"
      When Alice publishes her puzzle draft
      Then Bob's published pack still offers the puzzle edition "River"
      And Bob can discover the standalone puzzle "Valley"

    Scenario: Withdrawing a puzzle keeps its earlier published pack playable
      Given Alice has published the pack "Rivers" choosing the puzzle edition "River"
      When Alice withdraws the puzzle "River"
      Then Bob's published pack still offers the puzzle edition "River"
      And Bob cannot discover the standalone puzzle "River"

  Rule: A published pack's draft can be changed independently
    No counter-example: keeping the public order is the purpose of a working draft.

    Scenario: The published pack stays unchanged when its working draft is reordered
      Given Alice has published the pack "Rivers" containing "River, Valley"
      When Alice moves "Valley" before "River" in its working pack draft
      Then Bob's published pack contains "River, Valley" in that order
      And Alice's working pack draft contains "Valley, River" in that order

    Scenario: Republishing the pack makes the new order current
      Given Alice has published the pack "Rivers" containing "River, Valley"
      And Alice has a valid working pack draft containing "Valley, River"
      When Alice publishes her pack draft
      Then Bob can discover the pack "Rivers" with "Valley, River" in that order
      And Alice can still inspect the earlier pack edition

  Rule: A withdrawn pack keeps its saved attempts available
    No counter-example: withdrawal removes discovery rather than people's kept play.

    Scenario: Withdrawing a pack hides it without erasing a saved attempt
      Given Bob has a saved attempt from Alice's published pack "Rivers"
      When Alice withdraws the pack "Rivers"
      Then Bob cannot discover the pack "Rivers"
      And Bob can resume that saved attempt
