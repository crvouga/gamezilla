@domain:health
Feature: Realtime broker
  Every environment runs its own EMQX broker. A broker just created or
  restarted builds for a few minutes, so it gets that long to come up.
  OpenTofu may have replaced its credentials after this run started, so the
  checks use the secret store's current values.

  Background:
    Given the broker credentials are current from the secret store

  Scenario: The broker's API authenticates and every node runs
    Then the broker's API authenticates and every node is running

  Scenario: The server can publish a message
    Then the server's publish path accepts a message

  Scenario: Clients connect to the broker's host
    Then the clients' WSS address points at the broker's host

  Scenario: The stock admin login is refused
    Then the broker dashboard refuses the stock admin login

  Scenario: No broker credential is a public one
    Then no broker credential is one of the committed public credentials
