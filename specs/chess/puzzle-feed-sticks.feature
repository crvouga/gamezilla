@domain:chess @goal:chess-puzzles:4 @goal:works-offline:5
Feature: Feed choices stick
  A player sets up the feed once. Their choices are still there after the app
  closes, and they follow the player to their other devices.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space
    And Alice has saved a custom feed target raised by 1 step

  Scenario: The feed choices are kept after the app closes
    When Alice closes and reopens the app
    And Alice returns to their space
    Then Alice's feed targets a custom 1550

  @regression:puzzle-feed-settings-device-local
  Scenario: The feed choices reach the player's other device
    When Alice's account opens on another device
    Then Alice's other device's feed targets a custom 1550 within 30 seconds

  Scenario: The history filter is kept after the app closes
    Given Alice has changed the feed history to "Any" and saved the feed settings
    When Alice closes and reopens the app
    And Alice returns to their space
    Then Alice's feed history shows "Any"
