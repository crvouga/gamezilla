@domain:billing @synthetic
Feature: Payments
  When people pay for Plus, the team wants real payments taken only in a
  production environment, so no other environment ever takes real money.

  Rule: Real payments are taken only in a production environment
    No counter-example: the team checks this from outside, and nothing a person does is refused.

    Scenario: People can pay for Plus in production
      Then people can pay for Plus

    Scenario: Payments are real only in production
      Then payments in this environment are real exactly when it is a production environment
