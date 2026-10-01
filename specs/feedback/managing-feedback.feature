@domain:feedback
Feature: Manage authored feedback
  When the team has written feedback, the team wants to manage its own drafts
  and reports, so writing can be continued, corrected or removed deliberately.

  Rule: Authors can read and change their feedback

    Scenario: Changing a report keeps the updated writing
      Given the team has kept local feedback titled "Board movement"
      When the team changes that feedback to "Board polish" saying "Animate every move"
      Then feedback management shows "Board polish" saying "Animate every move"

    Scenario: Someone else's feedback is unavailable for changing
      Given feedback titled "Private observation" belongs to another developer
      When the team tries to change that feedback
      Then the change is refused because the feedback belongs to another developer

  Rule: Authors can delete drafts and reports deliberately

    Scenario: Deleting a draft removes it from feedback management
      Given the team has a draft titled "Board movement" saying "Keep the last move visible"
      When the team confirms deleting that feedback
      Then feedback management does not show "Board movement"

    Scenario: Deleting a report removes it from feedback management
      Given the team has kept local feedback titled "Board movement"
      When the team confirms deleting that feedback
      Then feedback management does not show "Board movement"

    Scenario: Cancelling deletion keeps the feedback
      Given the team has kept local feedback titled "Board movement"
      When the team cancels deleting that feedback
      Then feedback management shows "Board movement"

  Rule: Drafts and reports share one management list
    No counter-example: every authored draft and report is available in the wizard.

    Scenario: Management includes unfinished and sent feedback
      Given the team has kept local feedback titled "Board movement"
      And the team has a draft titled "Hint clarity" saying "Explain why this move works"
      When the team opens feedback management
      Then feedback management shows "Board movement"
      And the team can find the draft "Hint clarity" in feedback management
