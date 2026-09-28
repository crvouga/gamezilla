@domain:auth
Feature: How long a sign-in lasts
  When a person has signed in, they want to stay signed in without thinking
  about it, but not forever, and want signing out everywhere to reach only
  their own account, so a forgotten device never stays in it and nobody else
  is signed out with them.

  Rule: A sign-in lapses 30 days after it starts

    Background:
      Given Dave is signed in with their Apple account

    Scenario: A sign-in lasts 29 days
      When 29 days pass
      Then Dave is still signed in

    Scenario: A sign-in lapses after 30 days
      When 30 days pass
      Then Dave is signed out

  Rule: Signing out everywhere signs out every device of one's own account, and only those

    Background:
      Given Bob is signed in with their Google account
      And Bob is also signed in on a second device

    Scenario: Signing out everywhere signs Bob out on every device
      When Bob signs out everywhere
      Then Bob is signed out
      And Bob's second device is signed out

    Scenario: Signing out everywhere keeps other accounts signed in
      Given Alice is signed in with their Google account
      When Bob signs out everywhere
      Then Bob's second device is signed out
      And Alice is still signed in
