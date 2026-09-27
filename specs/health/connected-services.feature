@domain:health
Feature: Outside services
  When an outside service the app relies on stops accepting the app, the team
  wants to find out between releases, so people never hit it first.

  Scenario: The app can use every service it relies on
    Then the app has access to every service it relies on
    And every service the app relies on still accepts it
