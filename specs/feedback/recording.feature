@domain:feedback
Feature: Record a reproduction before giving feedback
  When a person can reproduce a bug, the team wants a recording of what
  happened, so they can follow the same reproduction steps.

  Rule: Opening Support never starts a recording
    No counter-example: recording only begins when the person asks for it.

    Scenario: Support keeps the person's activity unrecorded
      Given the team's app is working
      When the team opens Support
      Then no recording has started

  Rule: A stopped recording can be reviewed before sending feedback
    No counter-example: a recording is always reviewable before it is sent.

    Scenario: Stopping a reproduction makes the recording available to review
      Given the team is recording a reproduction
      When the team stops recording
      Then the team can review the recording before sending feedback

    Scenario: Recorded reproduction steps accompany the feedback
      Given the team has recorded a reproduction
      And the team has described a bug saying "Hint stays loading" expecting "The hint appears" reproducing "Open a puzzle and ask for a hint"
      When the team sends the feedback
      Then the local feedback includes the recording and its reproduction steps

  Rule: A discarded recording is never sent

    Scenario: Discarding a recording removes it from the feedback
      Given the team has recorded a reproduction
      When the team discards the recording
      Then the feedback has no recording

    Scenario: Keeping a recording keeps it available to review
      Given the team has recorded a reproduction
      When the team opens Support
      Then the team can review the recording before sending feedback

  Rule: Video is helpful but never required

    Scenario: A device without video still records reproduction steps
      Given the team's device cannot record video
      When the team records a reproduction
      Then the reproduction steps are recorded
      And the team is told video is unavailable

    Scenario: A person can send a bug without recording it
      Given the team has described a bug saying "Hint stays loading" expecting "The hint appears" reproducing "Open a puzzle and ask for a hint"
      When the team sends the feedback
      Then the team can read the local feedback
