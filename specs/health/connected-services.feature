@domain:health
Feature: Connected services
  The app can use every outside service it relies on, so a service that stops
  accepting the app shows up between releases, not when people hit it.

  Scenario: The app can use every service it relies on
    Then the app has access to every service it relies on
    And every service the app relies on still accepts it
