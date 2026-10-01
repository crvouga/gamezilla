@domain:feedback
Feature: Keep the feedback wizard out of the way
  When a developer is improving the app, the developer wants one feedback
  wizard close at hand, so writing feedback does not interrupt using the app.

  Rule: The command palette opens the single feedback wizard
    No counter-example: opening feedback again returns to the same wizard.

    Scenario: Feedback opens through the command palette
      Given the team's app is working
      When the team opens feedback from the command palette
      Then the team has one feedback wizard

    Scenario: Opening feedback again keeps the same wizard
      Given the team has opened the feedback wizard
      When the team opens feedback from the command palette
      Then the team has one feedback wizard

  Rule: Feedback does not occupy the app until opened
    No counter-example: closing the wizard keeps feedback out of the way.

    Scenario: Closing feedback clears the app for other work
      Given the team has opened the feedback wizard
      When the team closes the wizard
      Then feedback takes no permanent place in the app

  Rule: A phone gives the wizard its full width
    No counter-example: feedback writing uses the available width on a phone.

    Scenario: A phone opens a full-width feedback sheet
      Given the team is using the app on a phone
      When the team opens Support
      Then the feedback wizard is a full-width sheet

  Rule: A computer keeps a movable widget
    No counter-example: moving the widget never changes the feedback being written.

    Scenario: Moving feedback keeps unfinished writing
      Given the team has a draft titled "Board movement" saying "Keep the last move visible"
      When the team moves the feedback widget out of the way
      Then the feedback widget has moved
      And the draft is titled "Board movement" saying "Keep the last move visible"
