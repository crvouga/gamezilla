@domain:games
Feature: Customizing the feed is for people with an account
  When a guest reaches for the feed settings of the game's puzzles, they want
  an invitation to sign in rather than an error, so customizing the feed is
  something an account unlocks. Until then a guest plays the feed as it comes.

  Rule: A guest can play puzzles but needs an account to customize the feed

    @regression:guest-feed-customization-ungated
    Scenario: A guest reaching for the feed settings is invited to sign in
      Given Alice is a guest
      And Alice is playing puzzles in their space
      When Alice starts editing the feed settings
      Then Alice cannot customize the feed without an account

    Scenario: A guest's feed still serves puzzles at the seed rating
      Given Alice is a guest
      And Alice is hosting a space
      When Alice opens puzzles in their space
      Then Alice's feed targets 1500 automatically
      And Alice has a puzzle on the board
