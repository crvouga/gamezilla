@domain:spaces
Feature: Use your own space without a connection
  When a person is offline, they want to keep using their own spaces, so
  losing the connection never stops what they can do on their own.

  Rule: Creating a space works with or without a connection
    No counter-example: the hosting limit applies equally online and offline.

    @regression:space-offline-create-queued
    Scenario: A person creates and hosts a space without a connection
      Given Alice is signed in
      And Alice is offline
      When Alice creates a space
      Then Alice is in the space
      And Alice hosts 1 space

    Scenario: A guest creates and hosts a space without a connection
      Given Alice is a guest
      And Alice is offline
      When Alice creates a space
      Then Alice is in the space
      And Alice hosts 1 space

    Scenario: A person creates their first space offline on a fresh device
      Given Alice is offline on a fresh device
      When Alice creates a space
      Then Alice is in the space
      And Alice hosts 1 space

    Scenario: An offline space survives closing and reopening the app
      Given Alice is hosting a space created offline
      And Alice has closed and reopened the app
      When Alice returns to their space
      Then Alice is in the same space
      And Alice hosts 1 space

    Scenario: A space created offline stays the same space when the connection returns
      Given Alice is hosting a space created offline
      When the connection comes back
      Then Alice is in the same space
      And Alice hosts 1 space

  Rule: The hosting limit still applies without a connection

    Scenario: An offline host at their hosting limit is invited to Plus
      Given Alice is hosting a space
      And Alice is offline
      When Alice creates another space
      Then Alice is invited to get Plus to host more spaces
      And Alice hosts 1 space

    Scenario: An offline Plus member can host another space
      Given Alice is a Plus member
      And Alice is hosting a space
      And Alice is offline
      When Alice creates another space
      Then Alice hosts 2 spaces

  Rule: Joining someone else's space needs a connection

    @regression:space-offline-join-reports-success
    Scenario: Joining from a link without a connection says it needs one
      Given Alice is hosting a space
      And Bob is offline
      When Bob joins the space from the link
      Then Bob is told joining needs a connection within 15 seconds
      And Bob is not in a space
      And Bob can try joining again

    Scenario: A person can join a space while both people are online
      Given Alice is hosting a space
      When Bob joins the space from the link
      Then Bob is in the space

  Rule: A host can rename their space without a connection

    Scenario: An offline host sees their renamed space at once
      Given Alice is hosting a space
      And Alice is offline
      When Alice renames the space to "Friday puzzles"
      Then Alice sees the space is called "Friday puzzles" within 15 seconds

    Scenario: An offline host cannot give their space a name that is not allowed
      Given Alice is hosting a space
      And Alice is offline
      When Alice renames the space to "free coins at spam.gg"
      Then Alice is told that space name is not allowed

  Rule: A host can end their space without a connection
    No counter-example: ending one's own space needs nobody else's participation.

    Scenario: An offline host ends their space
      Given Alice is hosting a space
      And Alice is offline
      When Alice ends the space
      Then Alice is not in a space
      And Alice hosts 0 spaces
