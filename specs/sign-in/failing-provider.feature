@domain:sign-in
Feature: When Google or Apple is failing
  When Google or Apple cannot vouch for who is signing in, a person wants
  signing in to fail plainly and change nothing, so they can simply sign in
  once it recovers.

  Scenario: Signing in while Google is failing keeps Alice signed out
    Given Google is failing
    When Alice tries to sign in with Google
    Then Alice is told signing in with Google failed
    And Alice is signed out

  Scenario: Once Google recovers, Alice can sign in
    Given Alice tried to sign in with Google while it was failing
    And Google has recovered
    When Alice signs in with Google
    Then Alice is signed in
