@domain:journeys
Feature: Author and play Sokoban packs
  When Alice shares her Sokoban puzzles with Bob, they want building, playtesting, publishing and playing to work together, so Bob plays exactly what Alice made and both keep their work wherever they return.

  Rule: An author can share a playtested Sokoban puzzle in an ordered pack

    Scenario: Another person discovers the author's ordered Sokoban pack
      When Alice authors and playtests a Sokoban puzzle from a fresh device
      And Alice publishes it in a new pack after another Sokoban puzzle
      Then Bob discovers the Sokoban pack in Alice's chosen order

  Rule: Sokoban play survives closing the app, another device and time offline

    Scenario: Continuing on another device keeps the Sokoban attempt and the pack
      When Bob plays a Sokoban puzzle of a pack partway and closes the app
      And Bob continues that Sokoban puzzle on his other device
      Then Bob sees his Sokoban attempt exactly where he stopped
      When Bob finishes that Sokoban puzzle
      Then Bob is offered the next puzzle of that Sokoban pack

    Scenario: Offline Sokoban work is kept and publication waits for the connection
      When Alice edits a Sokoban draft and Bob plays the Sokoban starter pack offline
      And Alice publishes that Sokoban draft while offline
      Then Alice is told publication waits for her connection
      When their connection returns
      Then both people keep their Sokoban work and Bob discovers Alice's Sokoban puzzle
