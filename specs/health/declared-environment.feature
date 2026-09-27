@domain:health
Feature: Declared environment
  Each environment is exactly what the team declared for it, so a change made
  by hand, something removed by accident, or an unfinished release shows up.

  Scenario: Nobody has changed the environment by hand
    Then this environment is exactly as the team declared it
