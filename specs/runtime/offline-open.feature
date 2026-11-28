@domain:runtime
Feature: Using the app when the connection drops
  When a person has no connection, on a plane or in a tunnel, they want the
  open app to keep working and to reopen once a connection returns.
  Opening the web app in a new tab needs a connection.

  Rule: Settings stays available offline and the app reopens after reconnecting

    Scenario: The app reopens after the connection returns
      Given Alice has opened the app before
      And Alice is offline
      When the connection comes back
      And Alice closes and reopens the app
      Then Alice sees the tabs
      And Alice is on Spaces

    Scenario: Settings open without a connection
      Given Alice has opened the app before
      And Alice is offline
      When Alice opens Settings
      Then Alice is on Settings
