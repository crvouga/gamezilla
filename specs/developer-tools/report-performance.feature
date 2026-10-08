@domain:developer-tools
Feature: Find slow parts of the app in test reports
  When the team investigates a slow experience, the team wants to see where
  a test run spent its time, so they can find the steps that need attention.

  Rule: A heatmap shows recorded time and marks steps beyond the chosen allowance

    Scenario: A slow step stands out in the heatmap
      Given a test report records a step that took longer than the chosen allowance
      When the team opens that test report's heatmap
      Then the team sees the recorded time for that step
      And that step is marked as slow

    Scenario: A step within the allowance is not marked as slow
      Given a test report records a step within the chosen allowance
      When the team opens that test report's heatmap
      Then that step is not marked as slow because it stayed within the allowance

  Rule: Missing measurements never become evidence that a step was quick

    Scenario: A report without recorded time says measurements are unavailable
      Given a test report has no recorded time for its steps
      When the team opens that test report's heatmap
      Then the team is told measurements are unavailable

    Scenario: A report with recorded time offers its heatmap
      Given a test report records a step within the chosen allowance
      When the team opens that test report's heatmap
      Then the team sees the heatmap for its recorded steps

  Rule: Choosing a measured step shows its recorded moment
    No counter-example: a measured step without a recorded moment offers no moment to open.

    Scenario: A slow step leads to the place where it happened
      Given a test report records a slow step with a recorded moment
      When the team selects that step in the heatmap
      Then the team sees that step's recorded moment
