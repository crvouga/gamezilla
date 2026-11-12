@domain:feedback @synthetic
Feature: Bug reports can reach the team
  When people report a bug, the team wants every bug report received, so a
  bug report never waits on a device unnoticed.

  Rule: The environment can receive a bug report
    No counter-example: the team checks this from outside, and nothing a person does is refused.

    Scenario: The team can receive bug reports
      Then the team can receive bug reports in this environment
