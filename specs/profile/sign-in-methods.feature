@domain:profile
Feature: Manage sign-in methods
  A person can add and remove ways to get back into their account.

  Scenario: Apple can be connected, used to sign in, and removed
    Given Alice is signed in with Google
    When Alice connects Apple with a private address
    Then Alice has Google and Apple sign-in methods
    When Alice signs out
    And Alice signs in with their private Apple address
    Then Alice is still signed into the remembered account
    When Alice removes Apple from their account
    Then Alice has only Google as a sign-in method

  Scenario: The last sign-in method cannot be removed
    Given Alice is signed in with Google
    When Alice tries to remove Google
    Then Alice's only sign-in method remains connected

  Scenario: An Apple account already used by someone else cannot be connected
    Given Alice has signed in with their private Apple address
    When Alice signs out
    And Alice signs in with Google and remembers the account
    And Alice tries to connect the Apple account they used earlier
    Then Alice is told that Apple account belongs to another account
    And Alice has only Google as a sign-in method

  Scenario: An unverified address match can be confirmed as one account
    Given Alice has matching unverified Google and Apple addresses
    When Alice signs in with Google at the unverified address
    And Alice signs out
    And Alice signs in with Apple at the unverified address
    Then Alice is asked to prove the account match
    When Alice confirms the match with Google
    Then Alice is signed into the remembered account
    And Alice has Google and Apple sign-in methods

  Scenario: An unverified address match can stay as two accounts
    Given Alice has matching unverified Google and Apple addresses
    When Alice signs in with Google at the unverified address
    And Alice remembers the signed-in account
    And Alice signs out
    And Alice signs in with Apple at the unverified address
    Then Alice is asked to prove the account match
    When Alice keeps the accounts separate
    Then Alice is signed into a different account
