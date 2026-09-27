@domain:health
Feature: Client config
  The API materializes the synced client config from its secrets on its
  first database request, so a fresh deploy has none until something wakes
  it. Clients read these values through the same parser checked here.

  Background:
    Given the API has answered since its deploy

  Scenario: Every client config key is materialized
    Then every client config key is stored

  Scenario: Clients get the broker address from the secret store
    Then clients are given the broker's WSS address from the secret store

  Scenario: Clients are offered Google sign-in, not the mock Apple sign-in
    Then clients are offered Google sign-in and not Apple sign-in
