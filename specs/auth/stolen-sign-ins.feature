@domain:auth
Feature: Stolen sign-ins
  When someone steals a person's sign-in onto their own device, the person
  wants signing out, or connecting a sign-in method, to shut them out, so a
  stolen sign-in never outlasts the person's own.

  Background:
    Given Alice is signed in with their Google account

  Rule: A stolen sign-in gets into the account until the sign-in it was stolen from is over

    Scenario: A stolen sign-in gets into the same account
      When Eve steals Alice's sign-in
      Then Eve is signed into Alice's account

    Scenario: Signing out shuts out a stolen sign-in
      Given Eve has stolen Alice's sign-in
      When Alice signs out
      Then Eve is signed out

    Scenario: Connecting a sign-in method shuts out a stolen sign-in
      Given Eve has stolen Alice's sign-in
      When Alice connects Apple
      Then Eve is signed out
      And Alice is signed into the same account

    Scenario: Signing out offline forgets the sign-in only on that device
      Given Eve has stolen Alice's sign-in
      And Alice's device has lost its connection
      When Alice signs out
      Then Alice is signed out
      And Eve is still signed into Alice's account
