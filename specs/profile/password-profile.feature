@domain:profile
Feature: Keep a profile with an email address and password
  When a person wants an account without an outside account, they want to
  register and sign in with an email address and password, so their profile
  follows them when they return.

  Rule: A correct password keeps the account's profile, and an incorrect one changes nothing

    Scenario: Starting a password account keeps the guest's profile
      Given Alice is a guest
      And Alice's username is @alice_password
      When Alice registers with email address "alice@example.com" and password "cedar river lantern 37"
      Then Alice has a signed-in account
      And Alice's profile shows @alice_password

    Scenario: Signing back in restores the password account's profile
      Given Alice has a password account at "alice@example.com" with password "cedar river lantern 37" and username @alice_password
      And Alice is signed out
      When Alice signs in with email address "alice@example.com" and password "cedar river lantern 37"
      Then Alice has a signed-in account
      And Alice's profile shows @alice_password

    Scenario: An incorrect password leaves the guest's profile alone
      Given Alice has a password account at "alice@example.com" with password "cedar river lantern 37" and username @alice_password
      And Bob is a guest
      When Bob signs in with email address "alice@example.com" and password "wrong river lantern 37"
      Then Bob is told that the email address or password is incorrect
      And Bob is signed out
