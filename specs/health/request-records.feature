@domain:health @observability
Feature: Request records
  The app keeps a record of what each request did, and the team can look it up
  when something goes wrong.

  Scenario: The app records what each request did
    Then the app can record what each request did

  Scenario: The team can look up what a request did
    Then the team can look up what a request did
