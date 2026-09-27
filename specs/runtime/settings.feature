@domain:runtime
Feature: Settings that stick
  When a person has set their preferences, how the app looks and sounds, they
  want them kept on the device after the app closes, so they only set the app
  up once.

  Scenario: A chosen dark theme is kept after the app closes
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
