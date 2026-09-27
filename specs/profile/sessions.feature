@domain:profile
Feature: End account sessions
  When a device is lost or an Apple account is closed, the person's devices
  are signed out so nobody else stays in their account, and their other ways
  in keep working.

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

  Scenario: Deleting the Apple account that is Alice's only way in signs Alice out
    Given Alice is signed in with Apple
    When Alice deletes their Apple account
    Then Alice is signed out within 150 seconds

  Scenario: Deleting a connected Apple account keeps Alice signed in
    Given Alice has connected Apple to their Google account
    When Alice deletes their Apple account
    Then Alice is still signed into the same account

  Scenario: After deleting a connected Apple account, Google still signs Alice in
    Given Alice has connected Apple to their Google account
    And Alice has deleted their Apple account
    And Alice has signed out
    When Alice signs in with Google
    Then Alice is signed into the same account
    And Alice's sign-in methods are Google
