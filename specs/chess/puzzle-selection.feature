@domain:chess @goal:chess-puzzles:9
Feature: Choosing the next puzzle
  The feed serves puzzles suited to the player's rating from a window around
  it. The window is widest for a new player and narrows as their rating
  settles. A puzzle is never repeated while unseen ones remain, a puzzle that
  fails the quality bar is never served, and when every puzzle has been
  played the feed comes round to the oldest attempt, unrated.

  Background:
    Given the puzzle pool also holds:
      | puzzles | rated          | quality                                  |
      | 4       | near 1500      | good                                     |
      | 5       | near 1500      | too unpopular or too rarely played       |
      | 3       | 1800 to 1900   | good                                     |
    And Alice is signed in
    And Alice is playing puzzles in their space
    And every puzzle in the pool has reached Alice's device within 30 seconds

  Scenario: No puzzle repeats while unseen puzzles remain
    When Alice plays through every servable puzzle, alternately solving and skipping
    Then no puzzle was served to Alice twice
    And every puzzle Alice was served was rated

  Scenario: A low-quality puzzle is never served
    When Alice plays through every servable puzzle, alternately solving and skipping
    Then none of the low-quality puzzles was served to Alice

  Scenario: Puzzles inside the rating window come before those outside it
    When Alice plays through every servable puzzle, alternately solving and skipping
    Then every good puzzle near 1500 was served before any puzzle rated 1800 to 1900

  Scenario: A new player gets the widest window
    Then Alice's selection window is the widest there is

  Scenario: The window narrows as the rating settles
    When Alice plays 4 puzzles, alternately solving and skipping
    Then the server holds 4 rated attempts for Alice within 30 seconds
    And Alice's server rating deviation is below the starting deviation
    And Alice's selection window matches their server rating deviation within 30 seconds
    And Alice's selection window is narrower than the widest but no narrower than the narrowest

  Scenario: Pool exhaustion serves the oldest attempt first, unrated
    When Alice plays through every servable puzzle, alternately solving and skipping
    Then the server holds a rated attempt for every servable puzzle within 30 seconds
    And Alice's feed comes round to the first puzzle they played within 30 seconds
    And Alice's current attempt is unrated
    When Alice solves the puzzle
    Then the server holds a rated attempt for every servable puzzle
    And Alice's server rating and deviation are unchanged by the repeat
