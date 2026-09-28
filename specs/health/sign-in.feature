@domain:health
Feature: Signing in
  When a person signs in with Google in any environment, they want to land
  back in the app they started from, so signing in never strands them.

  Scenario: People are offered Google sign-in and not Apple sign-in
    Then people are offered Google sign-in and not Apple sign-in

  Scenario: Starting a Google sign-in hands the person to Google with the way back
    Then starting a Google sign-in hands the person to Google with the way back to the app

  Scenario: Google agrees to send people back after they sign in
    Then Google agrees to send people back to the app after they sign in

  Scenario: A person finishing signing in on the web knows whether it worked
    When a person on the web finishes signing in
    Then the app on the web knows whether they are signed in

  @oauth-relay
  Scenario: Google sign-ins started in another environment return to it
    Then Google sign-ins started in any other environment return to that environment
