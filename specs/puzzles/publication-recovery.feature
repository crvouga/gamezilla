@domain:puzzles
Feature: Keep a pack when publication cannot go ahead
  When an offline publication cannot go ahead, Alice wants her draft and a clear way to publish again, so an unavailable puzzle never costs her pack.

  Rule: Returning online publishes only packs whose chosen puzzles are still available

    Scenario: An offline publication becomes discoverable when its puzzles remain available
      Given Alice has chosen to publish the pack "Rivers" containing "River, Valley" on her offline phone
      When Alice's phone is back online
      Then Bob can discover the pack "Rivers" with "River, Valley" in that order
      And the pack draft contains "River, Valley" in that order

    Scenario: A chosen puzzle's withdrawal refuses publication without losing the pack
      Given Alice has chosen to publish the pack "Rivers" containing "River, Valley" on her offline phone
      And Alice has withdrawn the pack's puzzle "River" on her tablet
      When Alice's phone is back online
      Then Alice is told a pack puzzle is no longer available
      And Alice can read why the pack was not published while editing its draft
      And the pack draft contains "River, Valley" in that order
      And Bob cannot discover the pack "Rivers"

    Scenario: Reopening a published pack keeps its public edition available
      Given Alice has published the pack "Rivers" containing "River, Valley"
      When Alice reopens the app
      Then Bob can discover the pack "Rivers" with "River, Valley" in that order
      And the pack draft contains "River, Valley" in that order

  Rule: A private pack chosen for publication offline waits without losing its draft
    No counter-example: only a successful publication reaching other people makes the pack discoverable.

    Scenario: Choosing a new publication offline keeps it waiting and private
      Given Alice owns the pack draft "Rivers" containing "River, Valley"
      And Alice's phone has no connection
      When Alice publishes her pack draft
      Then Alice is told publication waits for her connection
      And the pack draft contains "River, Valley" in that order
      And Bob cannot discover the pack "Rivers"

    Scenario: Repeating a waiting publication keeps the pack private until a connection returns
      Given Alice has chosen to publish the pack "Rivers" containing "River, Valley" on her offline phone
      When Alice publishes her pack draft
      Then Alice is told publication waits for her connection
      And the pack draft contains "River, Valley" in that order
      And Bob cannot discover the pack "Rivers"

    Scenario: Reopening offline retains the publication choice and its draft
      Given Alice has chosen to publish the pack "Rivers" containing "River, Valley" on her offline phone
      When Alice reopens the app
      Then Alice is told publication waits for her connection
      And the pack draft contains "River, Valley" in that order
      And Bob cannot discover the pack "Rivers"

    Scenario: A corrected publication can be chosen again offline
      Given Alice's publication of the pack "Rivers" containing "River, Valley" was refused after "River" was withdrawn
      And the chosen puzzle "River" is published again
      And Alice's phone has no connection
      When Alice publishes her pack draft
      Then Alice is told publication waits for her connection
      And the pack draft contains "River, Valley" in that order
      And Bob cannot discover the pack "Rivers"

  Rule: A refused publication needs available puzzles and another publication choice

    Scenario: An author can publish again after the chosen puzzle becomes available
      Given Alice's publication of the pack "Rivers" containing "River, Valley" was refused after "River" was withdrawn
      And the chosen puzzle "River" is published again
      When Alice publishes her pack draft
      Then Bob can discover the pack "Rivers" with "River, Valley" in that order
      And the pack draft contains "River, Valley" in that order

    Scenario: Correcting the puzzle never publishes the refused pack on its own
      Given Alice's publication of the pack "Rivers" containing "River, Valley" was refused after "River" was withdrawn
      And Alice has a valid working draft of the chosen puzzle "River"
      When Alice publishes her puzzle draft
      Then Bob can discover the published puzzle "River"
      And Bob cannot discover the pack "Rivers"
      And the pack draft contains "River, Valley" in that order

    Scenario: Reopening a refused publication keeps its explanation and the private pack
      Given Alice's publication of the pack "Rivers" containing "River, Valley" was refused after "River" was withdrawn
      When Alice reopens the app
      Then Alice is told a pack puzzle is no longer available
      And Alice can read why the pack was not published while editing its draft
      And the pack draft contains "River, Valley" in that order
      And Bob cannot discover the pack "Rivers"

    Scenario: Publishing again while the puzzle is still withdrawn keeps the same private work
      Given Alice's publication of the pack "Rivers" containing "River, Valley" was refused after "River" was withdrawn
      When Alice publishes her pack draft
      Then Alice is told a pack puzzle is no longer available
      And Alice can read why the pack was not published while editing its draft
      And the pack draft contains "River, Valley" in that order
      And Bob cannot discover the pack "Rivers"
