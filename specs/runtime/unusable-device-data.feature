@domain:runtime
Feature: The app opens when its device data is unusable
  When what the app kept on their device cannot be used, a person wants the
  app to open and work anyway, so they are never locked out by something they
  cannot see or fix.

  Rule: The app opens even when its device data is unusable
    No counter-example: the app never refuses to open because of its device data.

    Scenario: The app opens after its device data became unusable
      Given Alice has opened the app before
      And Alice's device data has become unusable
      When Alice closes and reopens the app
      Then Alice sees the tabs
      And Alice is on Spaces

    Scenario: The app opens without a connection after its device data became unusable
      Given Alice has opened the app before
      And Alice is offline
      And Alice's device data has become unusable
      When Alice closes and reopens the app
      Then Alice sees the tabs
      And Alice is on Spaces

  Rule: The app works as usual while its device data is unusable
    No counter-example: nothing in the app is withheld because of its device data.

    Scenario: Settings open while the device data is unusable
      Given Alice has opened the app before
      And Alice's device data has become unusable
      And Alice has closed and reopened the app
      When Alice opens Settings
      Then Alice is on Settings
