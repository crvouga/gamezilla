@domain:runtime
Feature: The app opens without a connection
  When a person has no connection, on a plane or in a tunnel, they want the
  app to open and work anyway after its first opening, so they are never
  locked out.

  Rule: After its first opening the app and Settings open without a connection

    Scenario: The app opens without a connection after its first opening
      Given Alice has opened the app before
      And Alice is offline
      When Alice closes and reopens the app
      Then Alice sees the tabs
      And Alice is on Spaces

    Scenario: Settings open without a connection
      Given Alice has opened the app before
      And Alice is offline
      When Alice opens Settings
      Then Alice is on Settings
