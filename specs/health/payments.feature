@domain:health
Feature: Payments
  Only production takes real money; every other environment only pretends to.

  @production
  Scenario: People can pay for Plus in production
    Then people can pay for Plus

  Scenario: Payments are real only in production
    Then payments in this environment are real exactly when it is a production environment
