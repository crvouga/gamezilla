@domain:chess @goal:chess-puzzles:3
Feature: Choosing the next puzzle
  The feed serves puzzles suited to the player's rating, the nearest ones
  first, and never serves a puzzle that fails the quality bar, so every
  puzzle is worth playing.

  Background:
    Given the puzzle pool also holds:
      | puzzles | rated          | quality                                  |
      | 4       | near 1500      | good                                     |
      | 5       | near 1500      | too unpopular or too rarely played       |
      | 3       | 1800 to 1900   | good                                     |
    And Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: A low-quality puzzle is never served
    When Alice plays through every puzzle the feed offers
    Then none of the low-quality puzzles was served to Alice

  Scenario: Puzzles inside the rating window come before those outside it
    When Alice plays through every puzzle the feed offers
    Then every good puzzle near 1500 was served before any puzzle rated 1800 to 1900
