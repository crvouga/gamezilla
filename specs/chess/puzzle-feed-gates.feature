@domain:chess @goal:chess-puzzles:4 @goal:guest-free-and-paid:1 @goal:guest-free-and-paid:6
Feature: Customizing the feed is for people with an account
  Guests play the feed as it comes; customizing it is one of the things an
  account unlocks, and a guest who reaches for it is invited to sign in rather
  than shown an error.

  @regression:guest-feed-customization-ungated
  Scenario: A guest reaching for the feed settings is invited to sign in
    Given Alice is a guest
    And Alice is playing puzzles in their space
    When Alice starts editing the feed settings
    Then Alice is invited to sign in to customize the feed

  Scenario: A guest's feed still serves puzzles at the seed rating
    Given Alice is a guest
    And Alice is playing puzzles in their space
    Then Alice's feed targets 1500 automatically
    And Alice has a puzzle on the board
