@domain:profile
Feature: Sign-in while offline
  Signing in needs a connection, but signing out never waits for one: a
  device is signed out the moment its owner asks.

  Scenario: A sign-in abandoned offline does not block signing in once back online
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
