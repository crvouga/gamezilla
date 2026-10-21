@domain:profile
Feature: Sign out everywhere
  When a device is lost or an Apple account stops signing in, a person wants
  their devices signed out, so nobody else stays in their account, and their
  other sign-in methods keep working.

  Rule: Signing out everywhere or losing a sign-in method signs out the affected devices

    Scenario: Signing out everywhere signs Alice out on their other device too
      Given Alice is signed in with Google
      And Alice is also signed in on another device
      When Alice signs out everywhere
      Then Alice is signed out
      And Alice's other device is signed out within 150 seconds

    Scenario: Stopping Sign in with Apple for the app signs Alice out
      Given Alice is signed in with Apple
      When Alice stops using Sign in with Apple for the app
      Then Alice is signed out within 150 seconds

    Scenario: After stopping Sign in with Apple, Apple still opens the same account
      Given Alice has stopped using Sign in with Apple for the app
      When Alice signs in with Apple
      Then Alice is signed into the same account

    Scenario: Deleting the Apple account that is Alice's only sign-in method signs Alice out
      Given Alice is signed in with Apple
      When Alice deletes their Apple account
      Then Alice is signed out within 150 seconds

    @regression:apple-delete-stale-sign-in-methods
    Scenario: Deleting a connected Apple account makes Google the only sign-in method
      Given Alice has connected Apple to their account
      When Alice deletes their Apple account
      Then Alice is still signed into the same account
      And Alice's sign-in methods are Google within 20 seconds

  Rule: A device signed out from elsewhere tells the person once it finds out, and offers to sign in again

    @regression:involuntary-sign-out-silent
    Scenario: Signing out everywhere on another device tells Alice on this one
      Given Alice is signed in with Google
      And Alice is also signed in on another device
      When Alice signs out everywhere on their other device
      Then Alice is told they were signed out within 150 seconds
      And Alice is offered to sign in again

    Scenario: Signing out on purpose does not tell Alice they were signed out
      Given Alice is signed in with Google
      When Alice signs out
      Then Alice is not told they were signed out

    Scenario: The device Alice signs out everywhere from does not tell Alice they were signed out
      Given Alice is signed in with Google
      And Alice is also signed in on another device
      When Alice signs out everywhere
      Then Alice is not told they were signed out

  Rule: A device signed out from elsewhere says when changes it had not shared were not kept

    Scenario: Changes made offline before signing out everywhere elsewhere are named as not kept
      Given Alice is signed in with Google
      And Alice is also signed in on another device
      And Alice is offline
      And Alice has renamed themselves to @alice_two
      And Alice has signed out everywhere on their other device
      When the connection comes back
      Then Alice is told changes they had not shared were not kept within 150 seconds

    Scenario: A device with nothing unshared does not mention changes that were not kept
      Given Alice is signed in with Google
      And Alice is also signed in on another device
      When Alice signs out everywhere on their other device
      Then Alice is told they were signed out within 150 seconds
      And Alice is not told changes they had not shared were not kept
