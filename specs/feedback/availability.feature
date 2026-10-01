@domain:feedback
Feature: Report trouble even when the app is unusable
  When the app runs into trouble, the team wants to keep feedback,
  so the trouble can be investigated without depending on the app working.

  Rule: Support remains available when the app cannot help
    No counter-example: trouble with the app never prevents giving feedback.

    Scenario: A working app lets the team keep feedback
      Given the team's app is working
      When the team submits feedback titled "Chess board freezes" saying "The board stopped after a move"
      Then the team can read the local feedback
      And the feedback contains the available diagnostics

    Scenario: An app that stays loading lets the team keep feedback
      Given the team's app stays loading
      When the team submits feedback titled "Opening never finishes" saying "The opening screen stays visible"
      Then the team can read the local feedback

    Scenario: An app that crashes lets the team keep feedback
      Given the team's app has crashed
      When the team submits feedback titled "Board disappeared" saying "The app crashed during a game"
      Then the team can read the local feedback

    Scenario: Trouble opening Settings does not prevent feedback
      Given the team's app cannot open Settings
      When the team submits feedback titled "Settings cannot open" saying "Choosing Settings leaves a blank screen"
      Then the team can read the local feedback

    Scenario: Trouble signing in does not prevent feedback
      Given the team's app cannot sign in
      When the team submits feedback titled "Sign in stops" saying "Signing in never finishes"
      Then the team can read the local feedback

  Rule: Missing diagnostics never prevent feedback
    No counter-example: diagnostics are helpful but never required.

    Scenario: Unavailable diagnostics still keep useful feedback
      Given some diagnostics are unavailable
      When the team submits feedback titled "Board disappeared" saying "The app went blank"
      Then the team can read the local feedback
      And the feedback identifies unavailable diagnostics

    Scenario: Diagnostics that never arrive do not hold up feedback
      Given some diagnostics never arrive
      When the team submits feedback titled "App stopped responding" saying "Nothing happens after a move"
      Then the team can read the local feedback

  Rule: Local feedback need no connection and survive closing the app
    No counter-example: local feedback belongs to the team's repository.

    Scenario: The team keeps feedback while offline
      Given the team's device is offline
      When the team submits feedback titled "Offline board freezes" saying "The board stopped while offline"
      Then the team can read the local feedback

    Scenario: Closing the app keeps the feedback readable
      Given the team has kept local feedback titled "Chess board freezes"
      When the team's app closes
      Then the team can read the local feedback

  Rule: A feedback that cannot be sent remains available to keep
    No counter-example: connection trouble never prevents keeping the title and description.

    Scenario: Unreachable reporting lets the team keep the feedback for later
      Given the team cannot send feedback
      When the team submits feedback titled "Board froze" saying "Stopped after a move"
      Then the team can copy the feedback to keep for later
      And the feedback has not been saved locally
