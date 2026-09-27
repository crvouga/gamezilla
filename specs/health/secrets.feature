@domain:health
Feature: Secrets
  Every secret the app needs is in the secret store and still accepted live,
  so a revoked key or a suspended vendor account shows up between deploys.

  Scenario: Every registered secret is present and valid
    Given this environment's secrets are exported from the secret store
    Then every required secret is present
    And every present secret passes its live validation
