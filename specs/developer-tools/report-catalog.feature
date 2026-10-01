@domain:developer-tools
Feature: Find automated test reports
  When the team investigates automated outcomes, the team wants to find
  the right test report, so the evidence belongs to the edition under investigation.

  Rule: A test report belongs to the edition its test run checked
    No counter-example: every test report identifies its own edition; another edition has separate reports.

    Scenario: Opening an edition shows that edition's test runs
      Given two versions of the app have different completed test runs
      When the team opens the test reports for the earlier version of the app
      Then the team sees the earlier version's test runs
      And the later version's test runs cannot appear as evidence for the earlier version

  Rule: Finished test runs appear while other test runs are still running
    No counter-example: completing more test runs adds their outcomes without changing the already completed test runs.

    Scenario: A completed test run can be read before all test runs finish
      Given a version of the app has one completed test run and another still running
      When the team opens that version's test reports
      Then the team can open the completed test run's test report
      And the team sees that the other test run is still running

    Scenario: Returning to the same reports shows completed test runs once
      Given the team has already seen a completed test run while others are running
      When the team reopens that version's test reports
      Then the completed test run appears exactly once

  Rule: Finding test runs matches their names against supplied text

    Scenario: Searching finds a named test run without regard to letter case
      Given the test reports include test run "Alice accepts a friend request"
      When the team finds test reports matching "ALICE ACCEPTS"
      Then the team sees test run "Alice accepts a friend request"

    Scenario: Searching for an absent name shows no matches
      Given no test run has a name containing "Bob joins the club"
      When the team finds test reports matching "Bob joins the club"
      Then the team is told no test runs match the supplied text

  Rule: Filtering by failure shows failed test runs only

    Scenario: The failure view includes a failed test run
      Given the test reports include a failed test run and a passing test run
      When the team shows failed test runs only
      Then the team sees the failed test run

    Scenario: The failure view excludes a passing test run
      Given the test reports include a failed test run and a passing test run
      When the team shows failed test runs only
      Then the passing test run cannot appear because it passed
