@domain:spaces
Feature: Leave your account's space while its host is offline
  When a space's host is offline, a person who joined wants to leave on their
  account, so they can leave without waiting for the host to return.

  Rule: People who joined can leave from another device while the host is offline

    Background:
      Given Bob is signed in
      And Alice is hosting a space that Bob joined from the link
      And Alice is offline

    @regression:space-offline-host-hides-account-leave
    Scenario: A joined person can leave from another device
      Given Bob is also signed in on another device
      When Bob's other device opens Alice's space link
      Then Bob's other device can leave the space

    Scenario: A person who never joined is not offered to leave
      When Carol opens Alice's space link
      Then Carol is not offered to leave the space
