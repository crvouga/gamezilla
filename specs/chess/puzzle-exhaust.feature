@domain:chess
Feature: An exhausted feed
  When a solver has played every puzzle in the pool, or chosen feed
  settings no puzzle fits, they want to know what the feed can still serve,
  so it never silently runs dry.

  Background:
    Given the puzzle pool holds just three puzzles
    And Alice is signed in
    And Alice is playing puzzles in their space

  Rule: The puzzle feed serves unplayed puzzles first and keeps serving unrated attempts after the pool is played through

    Scenario: No puzzle is served twice while unplayed ones remain
      Given Alice has solved 2 puzzles in a row
      And Alice has moved on to the next puzzle
      When Alice solves the puzzle
      Then Alice's stats show 3 played, 3 solved, and 100% accuracy

    Scenario: Once every puzzle is played, the feed comes round to the oldest one, unrated
      Given Alice has solved 3 puzzles in a row
      When Alice moves on to the next puzzle
      Then Alice's feed comes round to the first puzzle they played within 15 seconds
      And Alice is told the attempt is unrated

  Rule: A feed choice no puzzle fits empties the feed, and including played puzzles brings puzzles back

    Scenario: A theme filter no puzzle fits empties the feed
      When Alice limits the feed to the "zugzwang" theme
      Then Alice is told the feed is empty within 15 seconds
      And Alice has no puzzle on the board

    Scenario: Including played puzzles recovers from an empty feed
      Given Alice has already played the pool's one "zugzwang" puzzle
      And Alice has limited the feed to the "zugzwang" theme and it is empty
      When Alice includes puzzles they have already played
      Then Alice's feed history shows "Any"
      And Alice has a puzzle on the board
