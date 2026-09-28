@domain:auth
Feature: When Google or Apple is having trouble
  When Google or Apple is having trouble, a person wants signing in with it
  to fail plainly and change nothing, so they can simply sign in once it
  recovers.

  Rule: While a provider is having trouble, signing in with it fails plainly and changes nothing

    Scenario: Signing in while Google is having trouble keeps Alice signed out
      Given Google is having trouble
      When Alice tries to sign in with Google
      Then Alice is told signing in with Google failed
      And Alice is signed out

    Scenario: Signing in while Apple is having trouble keeps Dave signed out
      Given Apple is having trouble
      When Dave tries to sign in with Apple
      Then Dave is told signing in with Apple failed
      And Dave is signed out

    Scenario: Trouble at Google does not stop Alice signing in with Apple
      Given Google is having trouble
      When Alice signs in with their Apple account
      Then Alice is signed into a new account

  Rule: Once a provider recovers, signing in with it works again
    No counter-example: until it recovers, the first rule's refusal holds.

    Scenario: Once Google recovers, Alice can sign in
      Given Alice tried to sign in with Google while it was having trouble
      And Google has recovered
      When Alice signs in with their Google account
      Then Alice is signed into a new account

    Scenario: Once Apple recovers, Dave can sign in
      Given Dave tried to sign in with Apple while it was having trouble
      And Apple has recovered
      When Dave signs in with their Apple account
      Then Dave is signed into a new account
