@domain:runtime
Feature: Settings that stick
  When a person has set their preferences, they
  want them kept on the device after the app closes, so they only set the app
  up once.

  Rule: Preferences stay on the device after the app closes and About shows the version of the app

    Scenario: Turned-off sounds stay off after the app closes
      Given Alice has turned sounds off
      When Alice closes and reopens the app
      Then Alice's sounds are off

    Scenario: A person can see which version of the app they have
      When Alice opens About in Settings
      Then Alice is shown the version of the app they have
