@domain:puzzles
Feature: Validate and playtest private puzzles
  When Alice prepares a puzzle for publication, she wants to play the draft with its real rules, so a successful check means people can actually complete it.

  Rule: Validation explains missing required puzzle details

    Scenario: A complete puzzle passes validation
      Given Alice owns a valid puzzle draft "River"
      When Alice validates her puzzle draft
      Then Alice is told the puzzle is ready for publication

    Scenario: An incomplete puzzle explains what must be corrected
      Given Alice owns a puzzle draft "River" with missing required details
      When Alice validates her puzzle draft
      Then Alice is told which puzzle details need correction
      And Alice's incomplete draft is kept

  Rule: A playtest uses the puzzle's rules without ordinary completion
    No counter-example: a playtest is always private practice rather than ordinary play.

    Scenario: Completing a private playtest keeps ordinary progress unchanged
      Given Alice is playtesting her valid puzzle draft "River"
      When Alice completes that playtest
      Then Alice sees that the playtest is complete
      And Alice has no ordinary completion for "River"
      And Bob cannot discover the puzzle "River"

  Rule: Only the author can playtest a private draft

    Scenario: An author can begin a draft playtest
      Given Alice owns a valid puzzle draft "River"
      When Alice playtests her puzzle draft
      Then Alice can play the private draft "River"

    Scenario: Another person cannot playtest a private draft
      Given Alice owns a valid puzzle draft "River"
      When Bob playtests Alice's puzzle draft "River"
      Then Bob is told that puzzle draft is private
      And Bob cannot read the puzzle details
