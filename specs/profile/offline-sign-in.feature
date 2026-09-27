@domain:profile
Feature: Sign-in while offline
  When a person is offline, they still want to sign out of their device at
  once, so nobody else stays in their account; signing in can wait until the
  connection comes back.

  Scenario: Abandoning signing in offline does not stop signing in once back online
    Given Alice is a guest
    And Alice is offline
    And Alice has abandoned signing in with Apple
    And the connection has come back
    When Alice signs in with Apple
    Then Alice has a signed-in account

  Scenario: Signing out works without a connection
    Given Alice is signed in with Google
    And Alice is offline
    When Alice signs out
    Then Alice is signed out

  Scenario: After signing out offline, Alice can sign back in once online
    Given Alice is signed in with Google
    And Alice is offline
    And Alice has signed out
    And the connection has come back
    When Alice signs in with Google
    Then Alice is signed into the same account
