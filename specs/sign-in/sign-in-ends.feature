@domain:sign-in
Feature: How long a sign-in lasts
  A person wants to stay signed in without thinking about it, but not
  forever, and wants signing out everywhere to reach only their own
  account, so a forgotten device never stays in it and nobody else is
  signed out with them.

  Scenario: A sign-in lasts 29 days
    Given Dave is signed in with Apple
    When 29 days pass
    Then Dave is still signed in

  Scenario: A sign-in lapses after 30 days
    Given Dave is signed in with Apple
    When 30 days pass
    Then Dave is signed out

  Scenario: Signing out everywhere keeps other accounts signed in
    Given Bob is signed in with Google
    And Bob is also signed in on another device
    And Alice is signed in with Google
    When Bob signs out everywhere
    Then Bob's other device is signed out
    And Alice is still signed in
