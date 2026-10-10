@domain:auth
Feature: Sign in with an email address and password
  When a person wants an account without an outside account, they want to
  register and sign in with their own password, so they can return to the
  same account on another device.

  Rule: A password account can be reached only with its correct password

    Scenario: A correct password reaches the same account again
      Given Alice has registered with email address "alice@example.com" and password "cedar river lantern 37"
      When Alice signs in with email address "alice@example.com" and password "cedar river lantern 37"
      Then Alice is signed into her registered account

    Scenario: A wrong password keeps the person signed out
      Given Alice has registered with email address "alice@example.com" and password "cedar river lantern 37"
      When Alice signs in with email address "alice@example.com" and password "wrong river lantern 37"
      Then Alice is told that the email address or password is incorrect
      And Alice is signed out

  Rule: Registration never takes over an existing password account

    Scenario: A new email address starts a password account
      Given Alice has no password account
      When Alice registers with email address "alice@example.com" and password "cedar river lantern 37"
      Then Alice is signed into her registered account

    Scenario: Reusing an email address does not replace its password
      Given Alice has registered with email address "alice@example.com" and password "cedar river lantern 37"
      When Bob registers with email address "alice@example.com" and password "different river lantern 99"
      Then Bob is told that registration could not be completed
      And Bob is signed out
