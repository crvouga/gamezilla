@domain:developer-tools
Feature: Move through a test report
  When the team follows an investigation through time, the team wants to
  move among recorded moments, so each step can be understood in order.

  Rule: Moving among recorded moments stops at the first and final recorded moments

    Scenario: Moving forward shows the following recorded moment
      Given the team is viewing the first of three recorded moments
      When the team moves to the next recorded moment
      Then the team sees the second recorded moment

    Scenario: Moving forward at the final recorded moment keeps the final recorded moment
      Given the team is viewing the final recorded moment
      When the team moves to the next recorded moment
      Then the team still sees the final recorded moment because there is no later moment

    Scenario: Moving backward shows the preceding recorded moment
      Given the team is viewing the second of three recorded moments
      When the team moves to the previous recorded moment
      Then the team sees the first recorded moment

    Scenario: Moving backward at the start keeps the first recorded moment
      Given the team is viewing the first recorded moment
      When the team moves to the previous recorded moment
      Then the team still sees the first recorded moment because there is no earlier moment

  Rule: Moving among failures wraps to the first failure and keeps a passing report in place

    Scenario: Moving past the final failure returns to the first failure
      Given the team is viewing the final of two failed recorded moments
      When the team moves to the next failed recorded moment
      Then the team sees the first failed recorded moment

    Scenario: A passing report has no failed recorded moment to move to
      Given the team is viewing a passing test report's final recorded moment
      When the team moves to the next failed recorded moment
      Then the team still sees the final recorded moment because no recorded moment failed

  Rule: An address selects a recorded moment when that moment exists

    Scenario: Opening a shared address selects its recorded moment
      Given a test report has three recorded moments
      When the team opens that test report's address for its second recorded moment
      Then the team sees the second recorded moment

    Scenario: An address beyond the report uses the report's usual starting moment
      Given a passing test report has three recorded moments
      When the team opens that test report's address for its fourth recorded moment
      Then the team still sees the final recorded moment because the fourth does not exist
