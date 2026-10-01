@domain:runtime @synthetic
Feature: Finding out what happened
  When someone runs into trouble, the team wants to find out what happened,
  so they can put it right.

  Rule: The app leaves a trail the team can follow
    No counter-example: the team checks this from outside, and nothing a person does is refused.

    Scenario: The app leaves a trail of what it does for people
      Then the app leaves a trail of what it does for people

    Scenario: The team can follow the trail of what the app did for someone
      Then the team can follow the trail of what the app did for someone
