@domain:puzzles
Feature: Continue and complete puzzle packs
  When Bob plays a pack, he wants to see and resume his progress, so each completed puzzle brings him closer to finishing the collection.

  Rule: A pack reports each chosen puzzle edition's progress

    Scenario: A new pack shows every puzzle unplayed
      Given Alice has published the pack "Rivers" containing "River, Valley"
      When Bob opens that published pack
      Then Bob sees two unplayed puzzles and no completed puzzles

    Scenario: Completing one puzzle counts it once in the pack
      Given Bob is playing "River" in the published pack "Rivers" containing "River, Valley"
      When Bob completes that puzzle
      Then Bob sees one completed puzzle out of two in "Rivers"
      And Bob is offered "Valley" as the next puzzle

    Scenario: Repeating a completed puzzle never increases its completion count
      Given Bob has already completed "River" in the published pack "Rivers" containing "River, Valley"
      When Bob completes another attempt at "River"
      Then Bob sees one completed puzzle out of two in "Rivers"

  Rule: Continuing returns to the last active unfinished puzzle
    No counter-example: when that puzzle is completed, continuing offers another unfinished puzzle instead.

    Scenario: A pack continues at its last unfinished puzzle
      Given Bob has unfinished play at "Valley" in the published pack "Rivers"
      When Bob continues the pack "Rivers"
      Then Bob resumes his saved position at "Valley"

  Rule: Puzzles may be played in any order
    No counter-example: these packs do not require earlier puzzles to unlock later ones.

    Scenario: A later puzzle can be started before the first
      Given Alice has published the pack "Rivers" containing "River, Valley"
      When Bob starts "Valley" from the pack "Rivers"
      Then Bob can play "Valley"
      And "River" remains unplayed

  Rule: Completing every chosen edition completes the pack

    Scenario: The last unfinished puzzle completes the pack
      Given Bob has completed "River" and is playing "Valley" in the published pack "Rivers"
      When Bob completes that puzzle
      Then Bob sees that the pack "Rivers" is complete
      And Bob sees two completed puzzles out of two in "Rivers"

    Scenario: An unfinished puzzle keeps the pack unfinished
      Given Bob has completed "River" in the published pack "Rivers" containing "River, Valley"
      When Bob returns to the pack overview
      Then Bob sees that the pack "Rivers" is unfinished
      And Bob is offered "Valley" as the next puzzle
