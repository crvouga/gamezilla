@domain:spaces
Feature: Leave your account's space while its host is offline
  When a space's host is offline, a person who joined wants to leave on their
  account, so they can leave without waiting for the host to return.

  Rule: People who joined can leave from another device while the host is offline

    @regression:space-offline-host-hides-account-leave
    Scenario: A joined person can leave from another device
      Given Bob is signed in
      And Alice is hosting a space that Bob joined from the link
      And Alice is offline
      And Bob is also signed in on another device
      When Bob's other device opens Alice's space link
      Then Bob's other device can leave the space

    Scenario: A person who never joined is not offered to leave
      Given Alice is hosting a space
      And Alice is offline
      When Carol opens Alice's space link
      Then Carol is not offered to leave the space

    Scenario: A joined person leaves while the host is offline
      Given Bob is signed in
      And Alice is hosting a space that Bob joined from the link
      And Alice is offline
      When Bob leaves the space
      Then Bob sees they have left the space

    Scenario: A joined person leaves without either person's connection
      Given Bob is signed in
      And Alice is hosting a space that Bob joined from the link
      And Alice is offline
      And Bob is offline
      When Bob leaves the space
      Then Bob sees they have left the space

    Scenario: Returning does not bring back someone who left offline
      Given Bob is signed in
      And Alice is hosting a space that Bob joined from the link
      And Alice is offline
      And Bob is offline
      And Bob has left the space
      When the connection comes back
      Then Bob sees they have left the space
      And Alice sees 1 person in the space within 20 seconds
