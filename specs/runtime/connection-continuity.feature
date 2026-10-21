@domain:runtime
Feature: Keep using the app while a connection is missing
  When a connection stops being useful, a person wants to keep their place and use what is already on their device, so an unfinished choice never prevents them from carrying on.

  Rule: A missing connection is shown without taking away the person's place
    No counter-example: a missing connection never chooses another place for the person.

    @regression:missing-connection-notice
    Scenario: Losing a connection on Settings keeps Settings usable
      Given Alice has opened Settings
      When Alice loses the connection
      Then Alice is told the connection is missing within 15 seconds
      And Alice is still on Settings
      And Alice can reach every control offered there

    Scenario: Reopening offline keeps the saved preferences available
      Given Alice has chosen the dark theme
      And Alice has a place in the app and saved preferences
      And Alice is offline
      When Alice closes and reopens the app
      Then Alice has the same place in the app and saved preferences
      And Alice's app is dark

  Rule: An unfinished choice never prevents another place in the app from being reached
    No counter-example: going elsewhere does not decide whether the unfinished choice counted.

    Background:
      Given Alice has a choice open that needs a connection and has not finished

    Scenario: Profile remains reachable during an unfinished choice
      When Alice opens the Profile tab
      Then Alice is on Profile
      And Alice is not told the unfinished choice succeeded

    Scenario: Settings remain reachable while a choice has not finished
      When Alice opens Settings
      Then Alice is on Settings
      And Alice can reach every control offered there

    Scenario: Closing an unfinished choice keeps the person's place
      When Alice puts aside the unfinished choice
      Then Alice has the same place in the app and saved preferences
      And Alice is not told the unfinished choice succeeded

  Rule: A choice needing a connection has a clear outcome instead of an endless wait

    Scenario: A lost connection explains an unfinished choice
      Given Alice has a choice open that needs a connection and has not finished
      When Alice loses the connection
      Then Alice is told the connection is missing within 15 seconds
      And Alice can put aside the unfinished choice

    Scenario: Returning does not carry out a choice that was refused offline
      Given Alice was told a choice needs a connection
      When the connection comes back
      Then Alice is offered to make that choice again
      And the refused choice has not happened on its own

    @regression:offline-sign-in-leaves-app-waiting
    Scenario: Signing in offline gives a clear refusal
      Given Alice is a guest
      And Alice is offline
      When Alice signs in with Google
      Then Alice is told signing in needs a connection

    Scenario: A local preference still changes with no connection
      Given Alice has chosen the dark theme
      And Alice is offline
      And Alice has opened the theme choices without choosing
      When Alice chooses the light theme
      Then Alice's app is light
      And Alice is not asked to wait for a connection

  Rule: Connection in Settings says whether the app is connected and what still works without a connection

    @regression:server-status-placeholder-shipped
    Scenario: Connection in Settings shows a connected app
      When Alice opens Connection in Settings
      Then Connection in Settings shows Alice the app is connected

    Scenario: Connection in Settings explains a missing connection and what still works
      Given Alice is offline
      When Alice opens Connection in Settings
      Then Connection in Settings shows Alice the connection is missing
      And Connection in Settings shows Alice what still works without a connection
