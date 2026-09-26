@domain:chess @goal:chess-puzzles:11
Feature: Rating, puzzles solved, and accuracy
  The stats show the current rating, the number of puzzles played and
  solved, and the overall accuracy. They count each puzzle's first rated
  attempt only, once ever: a retry within an attempt and an unrated repeat
  of an already-played puzzle leave them alone. A provisional rating shows a
  "?" after it.

  Scenario: Before any puzzle, the stats show the seed rating, provisional, and nothing played
    Given Alice is signed in
    And Alice is playing puzzles in their space
    When Alice opens their stats
    Then Alice's stats show a rating of "1500?"
    And Alice's stats show 0 played, 0 solved, and 0% accuracy

  Scenario: Two solves and one failure show as 3 played, 2 solved, 67% accuracy
    Given the puzzle pool holds the three standard puzzles
    And Alice is signed in
    And Alice is playing puzzles in their space
    When Alice solves the puzzle
    And Alice moves on to the next puzzle
    And Alice solves the puzzle
    And Alice moves on to the next puzzle
    And Alice plays a wrong move
    And Alice skips the puzzle
    And Alice moves on to the next puzzle
    Then each puzzle Alice attempted was rated at most once
    And the server holds 3 rated attempts for Alice within 30 seconds
    When Alice opens their stats
    Then Alice's stats show 3 played, 2 solved, and 67% accuracy
    And Alice's server rating is still provisional
    And Alice's stats show their server rating with the provisional marker

  Scenario: An unrated repeat attempt moves none of the figures
    Given the puzzle pool holds the three standard puzzles
    And Alice is signed in
    And Alice is playing puzzles in their space
    When Alice solves every puzzle in the pool
    And Alice moves on to the next puzzle
    Then the server holds 3 rated attempts for Alice within 30 seconds
    And Alice's rated attempts add up to 3 played, 3 solved, and 100% accuracy
    And Alice's feed comes round to a puzzle they already played within 30 seconds
    And Alice's current attempt is unrated
    When Alice solves the puzzle
    Then the server holds 3 rated attempts for Alice within 30 seconds
    When Alice opens their stats
    Then Alice's stats show 3 played, 3 solved, and 100% accuracy

  Scenario: The provisional marker clears once the deviation settles, and the figures still hold
    Given the puzzle pool holds puzzles rated near 1500
    And Alice is signed in
    And Alice is playing puzzles in their space
    When Alice alternately solves and skips puzzles until their rating is no longer provisional
    And Alice opens their stats
    Then Alice's server rating is not provisional
    And Alice's stats show their server rating with no provisional marker
    And Alice's stats show the played, solved, and accuracy figures of their rated attempts
