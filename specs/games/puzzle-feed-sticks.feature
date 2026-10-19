@domain:games
Feature: Feed choices stick
  When a solver has set up their feed for the game's puzzles, they want those
  feed choices kept, so the feed is still theirs after the app closes and on
  their other devices.

  Rule: Saved feed settings stay after the app closes and follow the account to other devices
    No counter-example: Saved choices belong to the account and remain its choices on return.

    Background:
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has saved a custom feed target raised by 1 step

    Scenario: The feed choices are kept after the app closes
      Given Alice has closed and reopened the app
      When Alice returns to their space
      Then Alice's feed targets a custom 1550

    @regression:puzzle-feed-settings-device-local
    Scenario: The feed choices reach the solver's other device
      When Alice's account opens on another device
      Then Alice's other device's feed targets a custom 1550 within 30 seconds

    Scenario: The history filter is kept after the app closes
      Given Alice has changed the feed history to "Any" and saved the feed settings
      And Alice has closed and reopened the app
      When Alice returns to their space
      Then Alice's feed history shows "Any"

  Rule: A chosen puzzle theme stays after the app closes and follows the account to other devices
    No counter-example: a chosen theme belongs to the account and remains its choice on return.

    Background:
      Given Alice is signed in
      And the puzzle pool holds puzzles with and without a theme of the game's known puzzle
      And Alice is playing puzzles in their space
      And Alice has limited the feed to that theme

    Scenario: The chosen theme is kept after the app closes
      Given Alice has closed and reopened the app
      When Alice returns to their space
      Then Alice's feed is limited to that theme

    Scenario: The chosen theme reaches the solver's other device
      When Alice's account opens on another device
      Then Alice's other device's feed is limited to that theme within 30 seconds

  Rule: A feed choice saved offline changes only that device until the connection comes back, then reaches the other device

    Background:
      Given Alice is signed in
      And Alice is also signed in on another device
      And Alice is playing puzzles in their space

    Scenario: A feed choice saved offline changes only the offline device
      Given Alice is offline
      And Alice has chosen an unsaved custom feed target raised by 1 step
      When Alice saves the feed settings
      Then Alice's feed targets a custom 1550
      And Alice's other device's feed still targets 1500 automatically

    Scenario: A feed choice saved offline reaches the other device once the connection comes back
      Given Alice has saved a custom feed target raised by 1 step while offline
      When the connection comes back
      Then Alice's other device's feed targets a custom 1550 within 30 seconds
