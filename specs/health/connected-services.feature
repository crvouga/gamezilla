@domain:health
Feature: Outside services
  When a company the app relies on, such as Google for signing in or the
  company that takes payments for Plus, stops letting the app use its
  service, the team wants to find out between releases, so people never run
  into it first.

  Scenario: Every outside service the app relies on still lets the app use it
    Then the app has what it needs to use every outside service it relies on
    And every outside service the app relies on still lets the app use it
