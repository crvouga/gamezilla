@domain:profile
Feature: Sign-in while offline
  Sign-in cannot complete without a connection, and local sign-out takes effect
  immediately even before the server can be reached.

  Scenario: An unfinished sign-in can succeed after reconnecting
    Given Alice is a guest
    When Alice loses the connection
    And Alice abandons Apple sign-in while offline
    Then Alice is signed out
    When the connection comes back
    And Alice signs in with Apple
    Then Alice has a signed-in account

  Scenario: Signing out offline signs this device out
    Given Alice is signed in with Google
    When Alice loses the connection
    And Alice signs out
    Then Alice can sign in again
    When the connection comes back
    And Alice signs in with Google
    Then Alice has a signed-in account
