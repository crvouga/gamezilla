@domain:feedback
Feature: Write feedback freely
  When the team sees a bug or an opportunity to improve the app, the team
  wants to write freely, so feedback describes what matters without a prescribed form.

  Rule: Feedback accepts freely arranged Markdown

    Scenario: Free-form feedback keeps the author's writing
      Given the team's app is working
      When the team submits feedback titled "Board movement" saying "# Movement\n\n- Pieces feel slow\n- Keep the last move visible"
      Then the team can read the local feedback
      And the feedback keeps the Markdown "# Movement\n\n- Pieces feel slow\n- Keep the last move visible"

    Scenario: Blank feedback explains what is missing
      Given the team has a draft titled "Board movement" saying "   "
      When the team sends the feedback
      Then the team is told to write something before sending feedback
      And the feedback has not been saved locally

  Rule: Templates are optional and preserve existing writing
    No counter-example: choosing a template never replaces the author's writing.

    Scenario: A bug template offers a starting point
      Given the team's app is working
      When the team chooses the bug template
      Then the draft offers prompts for what happened, what was expected and reproduction steps

    Scenario: A template keeps writing already in progress
      Given the team has a draft titled "Board movement" saying "Keep this observation"
      When the team chooses the polish template
      Then the draft includes "Keep this observation"
      And the draft offers prompts for an intended improvement
