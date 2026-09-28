@domain:auth
Feature: Proving an address match
  When a person signs in with a new outside account at the same unverified
  email address as an account they already have, they want to prove the
  match with that account's own sign-in method, so nobody else's outside
  account ever gets into their account.

  Scenario: Proving the match with someone else's Google account keeps Carol signed out
    Given Bob has an account they sign into with Google
    And Carol is being asked to prove an address match with Google
    When Carol proves the match with Bob's Google account
    Then Carol is told the match could not be proven
    And Carol is signed out

  Scenario: An address match not proven within 10 minutes lapses
    Given Carol was asked to prove an address match with Google 11 minutes ago
    When Carol proves the match with Google
    Then Carol is told the address match has lapsed
    And Carol is signed out
