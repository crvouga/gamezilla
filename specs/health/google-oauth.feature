@domain:health
Feature: Google OAuth client
  Every environment sends Google the same callback, the relay environment's,
  so a new environment needs no console edit. The relay's registration is the
  one human-managed setting; this is what notices if it goes missing.

  Scenario: Google accepts the shared sign-in callback
    Then Google accepts the shared callback for our OAuth client
