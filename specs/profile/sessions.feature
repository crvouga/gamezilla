@domain:profile
Feature: Sign out everywhere
  When a device is lost or an Apple account stops signing in, a person wants
  their devices signed out, so nobody else stays in their account, and their
  other sign-in methods keep working.

  Scenario: Signing out everywhere signs Alice out on their other device too
    Given Alice is signed in with Google
    And Alice is also signed in on another device
    When Alice signs out everywhere
    Then Alice is signed out
    And Alice's other device is signed out within 150 seconds

  Scenario: Stopping Sign in with Apple for the app signs Alice out
    Given Alice is signed in with Apple
    When Alice stops using Sign in with Apple for the app
    Then Alice is signed out within 150 seconds

  Scenario: After stopping Sign in with Apple, Apple still opens the same account
    Given Alice has stopped using Sign in with Apple for the app
    When Alice signs in with Apple
    Then Alice is signed into the same account

  Scenario: Deleting the Apple account that is Alice's only sign-in method signs Alice out
    Given Alice is signed in with Apple
    When Alice deletes their Apple account
    Then Alice is signed out within 150 seconds

  @regression:apple-delete-stale-sign-in-methods
  Scenario: Deleting a connected Apple account makes Google the only sign-in method
    Given Alice has connected Apple to their Google account
    When Alice deletes their Apple account
    Then Alice is still signed into the same account
    And Alice's sign-in methods are Google within 20 seconds
