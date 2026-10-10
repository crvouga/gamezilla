@domain:runtime
Feature: Choose to work offline
  When a person does not want the app to reach anyone else, they want to work
  offline from Settings or the command palette, so the app remains offline
  until they choose to work online.

  Rule: Settings and the command palette both switch working offline on and off
    No counter-example: every person can make this choice from either place.

    Scenario: Settings can make the app work offline
      When Alice chooses to work offline in Settings
      Then Alice is shown they are working offline

    Scenario: The command palette can make the app work offline
      When Alice chooses to work offline in the command palette
      Then Alice is shown they are working offline

    Scenario: Settings can make the app work online again
      Given Alice has chosen to work offline
      When Alice stops working offline in Settings
      Then Alice is shown they are online

    Scenario: The command palette can make the app work online again
      Given Alice has chosen to work offline
      When Alice stops working offline in the command palette
      Then Alice is shown they are online

  Rule: Working offline prevents choices that need a connection but keeps other choices available

    Scenario: A person working offline can still open Settings
      Given Alice has chosen to work offline
      When Alice opens Settings
      Then Alice is on Settings

    Scenario: A person working offline cannot sign in even when their device has a connection
      Given Alice is a guest who has chosen to work offline while their device has a connection
      When Alice signs in with Google
      Then Alice is told signing in needs a connection

  Rule: Working offline lasts until the person chooses to work online
    No counter-example: only the person's choice to work online ends working offline.

    Scenario: Reopening the app keeps the choice to work offline
      Given Alice has chosen to work offline
      When Alice closes and reopens the app
      Then Alice is still shown they are working offline

    Scenario: A returning connection does not end the choice to work offline
      Given Alice has chosen to work offline while their device had no connection
      When the connection comes back
      Then Alice is still shown they are working offline
