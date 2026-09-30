@domain:spaces @synthetic
Feature: Spaces
  When people host and join spaces, they want spaces to open in this
  environment, so they can play together.

  Rule: Spaces can open in this environment and the app can take people into one
    No counter-example: the team checks this from outside, and nothing a person does is refused.

    Scenario: People can host and join spaces in this environment
      Then spaces can open in this environment
      And the app can take people into a space
