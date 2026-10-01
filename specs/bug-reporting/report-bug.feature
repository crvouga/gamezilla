@domain:bug-reporting
Feature: Report trouble even when the app is unusable
  When the app runs into trouble, the team wants to keep a bug report,
  so the trouble can be investigated without depending on the app working.

  Rule: Report Bug remains available when the app cannot help
    No counter-example: trouble with the app never prevents bug reporting.

    Scenario: A working app lets the team keep a bug report
      Given the team's app is working
      When the team submits a bug report titled "Chess board freezes" saying "The board stopped after a move"
      Then the team can read the local bug report
      And the bug report contains the available diagnostics

    Scenario: An app that stays loading lets the team keep a bug report
      Given the team's app stays loading
      When the team submits a bug report titled "Opening never finishes" saying "The opening screen stays visible"
      Then the team can read the local bug report

    Scenario: An app that crashes lets the team keep a bug report
      Given the team's app has crashed
      When the team submits a bug report titled "Board disappeared" saying "The app crashed during a game"
      Then the team can read the local bug report

    Scenario: Trouble opening a screen does not prevent a bug report
      Given the team's app cannot open a screen
      When the team submits a bug report titled "Settings cannot open" saying "Choosing Settings leaves a blank screen"
      Then the team can read the local bug report

    Scenario: Trouble signing in does not prevent a bug report
      Given the team's app cannot sign in
      When the team submits a bug report titled "Sign in stops" saying "Signing in never finishes"
      Then the team can read the local bug report

  Rule: Missing diagnostics never prevent a bug report
    No counter-example: diagnostics are helpful but never required.

    Scenario: Unavailable diagnostics still keep a useful bug report
      Given some diagnostics are unavailable
      When the team submits a bug report titled "Board disappeared" saying "The app went blank"
      Then the team can read the local bug report
      And the bug report identifies unavailable diagnostics

    Scenario: Diagnostics that never arrive do not hold up a bug report
      Given some diagnostics never arrive
      When the team submits a bug report titled "App stopped responding" saying "Nothing happens after a move"
      Then the team can read the local bug report

  Rule: Local bug reports need no connection and survive closing the app
    No counter-example: a local bug report belongs to the team's repository.

    Scenario: The team keeps a bug report while offline
      Given the team's device is offline
      When the team submits a bug report titled "Offline board freezes" saying "The board stopped while offline"
      Then the team can read the local bug report

    Scenario: Closing the app keeps the bug report readable
      Given the team has kept a local bug report titled "Chess board freezes"
      When the team's app closes
      Then the team can read the local bug report
