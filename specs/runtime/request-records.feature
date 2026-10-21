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

  Rule: The trail is kept up to date
    No counter-example: the team checks this from outside, and nothing a person does is refused.

    Scenario: The trail is up to date
      Then the trail is up to date

  Rule: Each record in the trail says which environment it came from
    No counter-example: the team checks this from outside, and nothing a person does is refused.

    Scenario: Every record in the trail comes from an environment of the app
      Then every record in the trail comes from an environment of the app

  Rule: The trail says whose request it was
    No counter-example: the team checks this from outside, and nothing a person does is refused.

    Scenario: A request that needs an account says whose it was
      Then a request that needs an account says whose it was
