@domain:sign-in
Feature: Copied sign-ins
  When someone copies a person's sign-in onto their own device, the person
  wants signing out, or connecting a sign-in method, to shut the copy out,
  so a copied sign-in never outlasts their own.

  Scenario: A copied sign-in gets into the same account
    Given Alice is signed in with their Google account
    When Eve copies Alice's sign-in
    Then Eve is signed into Alice's account

  Scenario: Signing out shuts out a copied sign-in
    Given Alice is signed in with their Google account
    And Eve has copied Alice's sign-in
    When Alice signs out
    Then Eve is signed out

  Scenario: Signing out offline forgets the sign-in only on that device
    Given Alice is signed in with their Google account
    And Eve has copied Alice's sign-in
    And Alice's device has lost its connection
    When Alice signs out
    Then Alice is signed out
    And Eve is still signed into Alice's account

  Scenario: Connecting a sign-in method shuts out a copied sign-in
    Given Alice is signed in with their Google account
    And Eve has copied Alice's sign-in
    When Alice connects Apple
    Then Alice is still signed into their own account
    And Eve is signed out
