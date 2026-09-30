@domain:chess
Feature: Choosing the next puzzle
  When a solver moves on, they want a next puzzle suited to their rating and
  worth playing, so the nearest good puzzles come first, a poor puzzle is
  never served, and a settled rating stays within 100 of puzzles still there.

  Background:
    Given the puzzle pool also holds:
      | puzzles | rated          | quality                                  |
      | 4       | near 1500      | good                                     |
      | 5       | near 1500      | too unpopular or too rarely played       |
      | 3       | 1800 to 1900   | good                                     |
    And Alice is signed in

  Rule: The next puzzle is worth playing and near the solver's rating
    No counter-example: moving on keeps being offered while a good puzzle remains, and an empty feed is its own feature.

    Scenario: A low-quality puzzle is never served
    Given Alice is playing puzzles in their space
    When Alice plays through every puzzle the feed offers
    Then none of the low-quality puzzles was served to Alice

  Scenario: Puzzles inside the rating window come before those outside it
    Given Alice is playing puzzles in their space
    When Alice plays through every puzzle the feed offers
    Then every good puzzle near 1500 was served before any puzzle rated 1800 to 1900

  Scenario: A settled rating keeps the feed within 100 of it
    Given Alice's puzzle rating has settled at 1400
    And Alice is playing puzzles in their space
    And Alice has skipped the puzzle
    When Alice moves on to the next puzzle
    Then Alice is solving a puzzle rated between 1300 and 1500
