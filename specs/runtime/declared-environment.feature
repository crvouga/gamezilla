@domain:runtime @synthetic
Feature: Environments stay as the team planned them
  When an environment has been changed by hand, has lost something by
  accident, or has an unfinished release, the team wants it to show up, so
  each environment stays exactly as the team planned it.

  Rule: An environment stays exactly as the team planned it
    No counter-example: the team checks this from outside, and nothing a person does is refused.

    Scenario: Nobody has changed the environment by hand
      Then this environment is exactly as the team planned it
