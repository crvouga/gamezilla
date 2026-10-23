@domain:puzzles
Feature: Keep puzzle work without a connection
  When Alice or Bob loses a connection, they want their available puzzles and draft work to remain useful, so returning online never requires starting over.

  Rule: Draft authoring remains available offline
    No counter-example: publication reaching other people waits for a connection, but local authoring does not.

    Scenario: A puzzle can be created privately offline
      Given Alice's phone has no connection
      When Alice creates the puzzle draft "River"
      Then Alice has a private puzzle draft titled "River"

    Scenario: A puzzle created offline survives reopening
      Given Alice has created and saved the private puzzle draft "River" on her offline phone
      When Alice reopens the app
      Then Alice can resume editing her private puzzle draft "River"

    Scenario: A pack's changed order remains after reopening offline
      Given Alice has saved the pack order "Valley, River" on her offline phone
      When Alice reopens the app
      Then the pack draft contains "Valley, River" in that order

  Rule: Previously available play remains usable offline

    Scenario: Offline play resumes after reopening
      Given Bob has made progress in the published puzzle "River" on his offline phone
      When Bob reopens the app
      Then Bob can resume that unfinished puzzle position

    Scenario: A puzzle never available on the phone explains how to continue
      Given Bob's phone has no connection and has never had the puzzle "River"
      When Bob starts the standalone puzzle "River"
      Then Bob is told to reconnect to get that puzzle
      And Bob's other saved attempts are kept

  Rule: Returning online brings kept drafts and progress to another device
    No counter-example: different simultaneous work remains recoverable under the draft and attempt conflict rules.

    Scenario: An offline draft reaches its author's other device
      Given Alice has created and saved the private puzzle draft "River" on her offline phone
      When Alice's phone is back online
      Then Alice can edit the puzzle draft "River" on her tablet
      And Bob cannot discover the puzzle "River"

    Scenario: An offline completion reaches the person's other device once
      Given Bob has completed "River" on his offline phone in the published pack "Rivers" containing "River, Valley"
      When Bob's phone is back online
      Then Bob's tablet shows one completed puzzle out of two in "Rivers"

  Rule: Different continuations of the same attempt are both kept
    No counter-example: a person's progress on one device must never silently erase accepted play on another.

    Scenario: Two devices keep their different puzzle continuations
      Given Bob's phone and tablet had the same unfinished puzzle attempt
      And Bob has continued that attempt on his phone
      When Bob continues from his tablet's earlier position
      Then Bob can choose either saved puzzle continuation
