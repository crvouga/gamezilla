@domain:chess @goal:chess-puzzles:11
Feature: Rating, puzzles solved, and accuracy
  When a solver wants to know how they are doing, they want stats showing
  the current rating, the number of puzzles played and solved, and the
  overall accuracy. They count each puzzle's first rated attempt only. A
  provisional rating shows a "?" after it.

  Scenario: Before any puzzle, the stats show the seed rating, provisional, and nothing played
    Given Alice is signed in
    And Alice is playing puzzles in their space
    When Alice opens their stats
    Then Alice's stats show a rating of "1500?"
    And Alice's stats show 0 played, 0 solved, and 0% accuracy

  Scenario: Two solves and one failure show as 3 played, 2 solved, 67% accuracy
    Given Alice is signed in
    And Alice is playing puzzles in their space
    And Alice has solved 2 puzzles and failed 1
    When Alice opens their stats
    Then Alice's stats show 3 played, 2 solved, and 67% accuracy

  Scenario: The stats show how the rating moved over time
    Given Alice is signed in
    And Alice is playing puzzles in their space
    And Alice has solved 2 puzzles and failed 1
    When Alice opens their stats
    Then Alice's stats show their rating after each of those 3 puzzles
