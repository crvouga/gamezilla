@domain:health
Feature: Infrastructure
  Live infrastructure equals libs/infra/tofu for this environment: a console
  edit, a resource deleted by hand or a half-finished deploy shows up here.

  Scenario Outline: The <stack> stack has no drift
    Then the "<stack>" stack plans no changes and passes the stateful policy

    Examples:
      | stack      |
      | foundation |
      | edge       |
