@domain:feedback
Feature: Keep feedback drafts
  When the team is interrupted while writing feedback, the team wants to keep
  its place, so no writing is lost when returning to the app.

  Rule: Closing the wizard keeps its draft
    No counter-example: closing is never a request to discard feedback.

    Scenario: Returning to the wizard restores unfinished writing
      Given the team has a draft titled "Board movement" saying "Keep the last move visible"
      When the team returns to the wizard after closing it
      Then the draft is titled "Board movement" saying "Keep the last move visible"

  Rule: Closing the app keeps drafts
    No counter-example: unfinished feedback is kept until its author deletes it.

    Scenario: Returning to the app restores unfinished writing
      Given the team has a draft titled "Board movement" saying "Keep the last move visible"
      When the team's app reopens after closing
      Then the draft is titled "Board movement" saying "Keep the last move visible"

  Rule: New drafts keep other drafts
    No counter-example: starting new feedback never replaces another draft.

    Scenario: Starting another draft keeps earlier writing
      Given the team has a draft titled "Board movement" saying "Keep the last move visible"
      When the team starts new feedback
      Then the team can find the draft "Board movement" in feedback management

  Rule: Trouble sending keeps the draft
    No counter-example: feedback stays editable until sending succeeds.

    Scenario: Failed sending preserves the author's writing
      Given the team cannot send feedback
      And the team has a draft titled "Board movement" saying "Keep the last move visible"
      When the team sends the feedback
      Then the draft is titled "Board movement" saying "Keep the last move visible"
      And the team can copy the feedback to keep for later

  Rule: Closing the app keeps reviewable recordings
    No counter-example: a recording stays with its draft until the author discards it.

    Scenario: Returning to the app restores a reproduction ready to review
      Given the team has stopped a reproduction recording
      When the team's app reopens after closing
      Then the team can review the recording before sending feedback
