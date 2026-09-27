@domain:runtime
Feature: Settings that stick
  People set the app up the way they like it once. Their look and sound
  choices are kept on the device after the app closes.

  Scenario: A chosen theme is kept after the app closes
    Given Alice has chosen the dark theme
    When Alice closes and reopens the app
    Then Alice's app is dark

  Scenario: Turned-off sounds stay off after the app closes
    Given Alice has turned sounds off
    When Alice closes and reopens the app
    Then Alice's sounds are off

  Scenario: A person can see which version of the app they have
    When Alice opens About in Settings
    Then Alice is shown the version of the app they have
