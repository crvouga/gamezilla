@domain:health
Feature: API
  The environment's API Worker is reachable on its hosts, ready, and serves
  the web app. Right after a deploy the custom domain may still be warming
  up, so the API gets a few minutes before it must answer.

  Scenario: Every host of the environment resolves in DNS
    Then every host of this environment resolves in DNS

  Scenario: Every host of the environment has a lasting TLS certificate
    Then every host of this environment has a TLS certificate valid for 14 more days

  Scenario: The API answers its health check
    Then the API answers its health check

  Scenario: Every hard dependency of the API is ready
    Then the API reports every hard dependency ready

  Scenario: The web app may read the API's sign-in answers
    When the web app exchanges a sign-in code with the API
    Then the answer is readable by the web app

  Scenario: Google sign-in starts with the shared callback
    Then the API's Google sign-in launch redirects to Google with the shared callback

  @oauth-relay
  Scenario: The relay forwards every other environment's Google callbacks
    Then the API forwards every other environment's Google callbacks to that environment
