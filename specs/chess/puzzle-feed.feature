@domain:chess
Feature: Chess puzzle themes in the feed
  When a chess solver wants to practise one kind of chess puzzle, such as a
  "fork", they want to limit the feed to that chess theme, so the feed
  serves only chess puzzles of that kind.

  Rule: The feed can be limited to a chess puzzle theme such as "fork", and then serves only chess puzzles with it

    Background:
      Given Alice is signed in
      And the puzzle pool holds puzzles with and without the "fork" theme
      And Alice is playing puzzles in their space

    Scenario: Choosing the "fork" theme serves a chess puzzle with that theme
      When Alice limits the feed to the "fork" theme
      Then Alice is served a puzzle with the "fork" theme

    Scenario: A chess puzzle without the "fork" theme is not offered
      Given Alice has limited the feed to the "fork" theme
      And Alice has skipped the puzzle
      When Alice moves on to the next puzzle
      Then Alice is not offered a puzzle without the "fork" theme
