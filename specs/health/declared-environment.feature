@domain:health
Feature: Environments stay as the team planned them
  When an environment has been changed by hand, has lost something by
  accident, or has an unfinished release, the team wants it to show up, so
  each environment stays exactly as the team planned it.

  Scenario: Nobody has changed the environment by hand
    Then this environment is exactly as the team planned it
