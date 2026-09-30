@domain:chess
Feature: Feed choices stick
  When a solver has set up their feed, they want those feed choices kept, so
  the feed is still theirs after the app closes and on their other devices.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space
    And Alice has saved a custom feed target raised by 1 step

  Scenario: The feed choices are kept after the app closes
    When Alice closes and reopens the app
    And Alice returns to their space
    Then Alice's feed targets a custom 1550

  @regression:puzzle-feed-settings-device-local
  Scenario: The feed choices reach the solver's other device
    When Alice's account opens on another device
    Then Alice's other device's feed targets a custom 1550 within 30 seconds

  Scenario: The history filter is kept after the app closes
    Given Alice has changed the feed history to "Any" and saved the feed settings
    When Alice closes and reopens the app
    And Alice returns to their space
    Then Alice's feed history shows "Any"
