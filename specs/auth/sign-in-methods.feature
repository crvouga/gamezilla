@domain:auth
Feature: Keeping sign-in methods straight
  When a person connects or removes a sign-in method, they want each outside
  account to get into exactly one account, so managing their sign-in methods
  never lets them, or anyone else, into the wrong account.

  Rule: A sign-in method connects only when it is the account's first from that provider and no other account uses it

    Scenario: Alice connects Apple to their account
      Given Alice is signed in with their Google account
      When Alice connects Apple
      Then Alice's sign-in methods are Google and Apple

    Scenario: A second Google account cannot be connected
      Given Alice is signed in with their Google account
      When Alice tries to connect a second Google account
      Then Alice is told the account already has Google
      And Alice's sign-in methods are still Google

    Scenario: Connecting on a device Dave used never reaches Dave's account
      Given Dave has opened their sign-in methods on a shared device
      And Dave has signed out on that device
      And Alice has signed in with Google on that device
      When Alice tries to connect Dave's Apple account
      Then Alice is told that Apple account belongs to another account
      And Alice is still signed into their own account

  Rule: Connecting a sign-in method needs a connection

    Background:
      Given Alice is signed in with their Google account
      And Alice's device has lost its connection

    Scenario: Alice connects Apple once their device is back online
      Given Alice's device is back online
      When Alice connects Apple
      Then Alice's sign-in methods are Google and Apple

    Scenario: Connecting Apple offline changes no sign-in method
      When Alice tries to connect Apple
      Then Alice is told connecting failed
      And Alice's sign-in methods are still Google

  Rule: A removed sign-in method no longer gets into the account, and the last one cannot be removed

    Scenario: Alice removes Apple from their account
      Given Alice has connected Apple to their account
      When Alice removes Apple from their account
      Then Alice's sign-in methods are Google

    Scenario: A removed Apple account signs into a new account
      Given Alice has connected Apple to their account
      And Alice has removed Apple from their account
      When Alice signs in with Apple on another device
      Then Alice's other device is signed into a different account

    Scenario: Alice cannot remove their last sign-in method
      Given Alice is signed in with their Google account
      When Alice tries to remove Google from their account
      Then Alice is told the last sign-in method cannot be removed
      And Alice's sign-in methods are still Google
