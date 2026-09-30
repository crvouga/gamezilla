@domain:chess
Feature: Rating, puzzles solved, and accuracy
  When a solver wants to know how they are doing, they want the rating, the
  puzzles played and solved, and the accuracy together, so one glance shows
  the record of their rated play, counting each puzzle's first rated attempt,
  and a new solver sees a provisional rating.

  Rule: Stats show the rating, the puzzles played and solved, and the accuracy
    No counter-example: stats are a reading of rated play, offered whenever the solver is playing puzzles.

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
