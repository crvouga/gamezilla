@domain:health
Feature: Declared environment
  When an environment has been changed by hand, has lost something by
  accident, or has an unfinished release, the team wants it to show up, so
  each environment stays exactly what the team declared for it.

  Scenario: Nobody has changed the environment by hand
    Then this environment is exactly as the team declared it
