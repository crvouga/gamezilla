@domain:health
Feature: Billing
  Production environments bill live; every other environment uses test or
  sandbox keys.

  @production
  Scenario: A production environment bills through at least one provider
    Then at least one billing provider is configured

  Scenario: Every billing key matches the environment's mode
    Then every configured billing key is in this environment's mode
