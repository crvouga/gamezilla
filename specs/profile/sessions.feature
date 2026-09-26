@domain:profile
Feature: End account sessions

  Scenario: Signing out everywhere ends the other device's session
    Given Alice is signed in with Google
    And Bob signs into Alice's account on another device
    When Alice signs out everywhere
    Then Alice is signed out
    And Bob is signed out after the session update

  Scenario: Revoking Apple in its app signs out, and Apple can sign in again
    Given Alice is signed in with Apple and remembers the account
    When Apple revokes the app for Alice
    Then Alice is signed out
    When Alice signs in with Apple again
    Then Alice is signed into the remembered account

  Scenario: Deleting the only Apple account ends its product session
    Given Alice is signed in with the private Apple account
    When Alice deletes that Apple account
    Then Alice is signed out
    And Alice has no remaining sign-in methods

  Scenario: Deleting a linked Apple account leaves Google sign-in intact
    Given Alice is signed in with Google
    When Alice connects Apple
    And Apple deletes Alice's private account
    Then Alice remains signed into the remembered account
    And Alice's account has only Google as a sign-in method
