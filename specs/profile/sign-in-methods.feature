@domain:profile
Feature: Manage sign-in methods
  When a person has more than one outside account, they want to connect a
  sign-in method or remove a sign-in method, so they can always sign in to
  their account and never lose their last one.

  Scenario: A connected Apple account becomes a sign-in method
    Given Alice is signed in with Google
    When Alice connects Apple
    Then Alice's sign-in methods are Google and Apple

  Scenario: A connected Apple account signs Alice into the same account
    Given Alice has connected Apple to their account
    And Alice has signed out
    When Alice signs in with Apple
    Then Alice is signed into the same account

  Scenario: A connected Apple account can be removed
    Given Alice has connected Apple to their account
    When Alice removes Apple from their account
    Then Alice's sign-in methods are Google

  Scenario: The last sign-in method cannot be removed
    Given Alice is signed in with Google
    When Alice tries to remove Google
    Then Alice's sign-in methods are still Google

  Scenario: An Apple account that already signs into another account cannot be connected
    Given Alice's Apple account already signs into a separate account
    And Alice is signed in with Google
    When Alice tries to connect that Apple account
    Then Alice is told that Apple account belongs to another account
    And Alice's sign-in methods are Google

  Scenario: An unverified address match has Alice prove the accounts are theirs
    Given Alice has an account they sign into with Google at an unverified address
    And Alice has signed out
    When Alice signs in with Apple at the same address
    Then Alice is asked to prove the account match
    And Alice is signed out

  Scenario: Proving an unverified address match with Google makes one account
    Given Alice is being asked to prove an unverified address match
    When Alice confirms the match with Google
    Then Alice is signed into the same account
    And Alice's sign-in methods are Google and Apple

  Scenario: Keeping an unverified address match separate makes a new account
    Given Alice is being asked to prove an unverified address match
    When Alice keeps the accounts separate
    Then Alice is signed into a different account
