@domain:spaces
Feature: End a deleted account's place in spaces
  When a person deletes their account, everyone in their spaces wants a
  clear outcome, so nobody waits in a space that has lost its host.

  Rule: A deleted host's spaces end for everyone

    Scenario: Deleting the host's account ends the space
      Given Alice is hosting a space that Bob joined from the link
      And Alice has a recently proven account
      When Alice confirms account deletion
      Then Bob sees the space has ended within 15 seconds

    Scenario: The ended space's link cannot admit another person
      Given Alice's account deletion has ended Alice's space
      When Bob opens Alice's space link
      Then Bob cannot join because the space has ended

  Rule: Deleting a joined person's account keeps the host's space open

    Scenario: The deleted person stops showing in presence
      Given Bob is hosting a space that Alice joined from the link
      And Alice has a recently proven account
      When Alice confirms account deletion
      Then Bob sees only Bob in the space within 15 seconds
      And Bob's space is open

    Scenario: The deleted account cannot rejoin the open space
      Given Alice's account deletion has been confirmed
      When Alice's other device attempts to join Bob's open space as the deleted account
      Then Alice is told to sign in again because the account was deleted
