@domain:health
Feature: Signing in
  People can sign in with Google in every environment and land back in the
  app they started from.

  Scenario: People are offered Google sign-in and not Apple sign-in
    Then people are offered Google sign-in and not Apple sign-in

  Scenario: Starting a Google sign-in hands the person to Google with the way back
    Then starting a Google sign-in hands the person to Google with the way back to the app

  Scenario: Google agrees to send people back after they sign in
    Then Google agrees to send people back to the app after they sign in

  Scenario: The web app hears back when a person finishes signing in
    When a person on the web completes a sign-in
    Then the web app hears whether the sign-in worked

  @oauth-relay
  Scenario: Google sign-ins started in another environment return to it
    Then Google sign-ins started in any other environment return to that environment
