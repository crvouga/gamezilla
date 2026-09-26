@domain:chess @goal:chess-puzzles:5
Feature: An exhausted feed
  The pool is never a dead end. Once every unseen puzzle is played the feed
  comes round to the puzzle attempted longest ago, and that attempt is
  unrated. Only a filter that matches nothing leaves the feed empty, and
  widening the filter recovers.

  Background:
    Given the puzzle pool holds the three standard puzzles
    And Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: After every unseen puzzle is solved, the oldest attempt comes round again, unrated
    When Alice solves every puzzle in the pool
    And Alice moves on to the next puzzle
    Then every puzzle Alice was served was new to them and rated
    And Alice's feed comes round to the first puzzle they played within 15 seconds
    And Alice's current attempt is unrated
    And Alice is not told the feed is empty

  Scenario: A theme filter that matches nothing leaves the feed empty
    When Alice limits the feed to the "zugzwang" theme
    Then Alice is told the feed is empty within 15 seconds
    And Alice has no puzzle on the board

  Scenario: Including played puzzles recovers from an empty feed
    Given Alice has limited the feed to the "zugzwang" theme and it is empty
    When Alice includes puzzles they have already played
    Then Alice's feed history shows "Any"
    And Alice has a puzzle on the board
    And Alice is not told the feed is empty
