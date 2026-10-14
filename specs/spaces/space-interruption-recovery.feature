@domain:spaces
Feature: Keep a space usable through time without a connection
  When people cannot reach one another, they want their own choices and the space they know kept, so returning never brings back an ended space or somebody who left.

  Rule: The host's own choices remain available without anyone else's connection
    No counter-example: local hosting choices remain subject to the same hosting and naming rules.

    Scenario: A host can rename while everyone is offline
      Given Alice is hosting a space that Bob joined from the link
      And Alice and Bob are offline
      When Alice renames the space to "Friday puzzles"
      Then Alice sees the space is called "Friday puzzles" within 15 seconds
      And Alice is in the space

    Scenario: A host can end a space while everyone is offline
      Given Alice is hosting a space that Bob joined from the link
      And Alice and Bob are offline
      When Alice ends the space
      Then Alice sees the space has ended within 20 seconds
      And Alice hosts 0 spaces

  Rule: A person can leave while nobody else can be reached
    No counter-example: leaving needs nobody else's agreement.

    Scenario: Leaving offline frees the person to use their own space
      Given Alice is hosting a space that Bob joined from the link
      And Alice and Bob are offline
      And Bob has a space of their own
      When Bob leaves the space
      Then Bob sees they have left the space
      And Bob can return to their own space

  Rule: Returning people see the lasting end or departure before being offered to join

    Scenario: An end made offline remains an end after both apps reopen
      Given Alice is hosting a space that Bob joined from the link
      And Alice has ended the space while Alice and Bob were offline
      And Alice and Bob have closed and reopened the app
      When the connection comes back
      Then Bob sees the space has ended within 20 seconds
      And Bob is not offered to join

    Scenario: A departure made offline remains a departure when the host returns first
      Given Alice is hosting a space that Bob joined from the link
      And Bob has left the space while Alice and Bob were offline
      And Alice has come back online before Bob
      When Bob comes back online
      Then Bob sees they have left the space
      And Alice sees 1 person in the space within 20 seconds

    Scenario: A new join after returning is an explicit choice
      Given Alice is hosting a space
      And Bob has left the space while offline
      And the connection has come back
      When Bob joins the space from the link
      Then Bob is in the space
      And Alice sees Bob once in the space's presence

  Rule: An unanswered join does not trap the person or claim they joined

    Scenario: A person can leave a join that has not finished
      Given Alice is hosting a space
      And Bob has asked to join from the space link without hearing whether they joined
      When Bob goes back to the lobby
      Then Bob sees their lobby
      And Bob is not told they joined Alice's space

    Scenario: A join accepted before the connection was lost is found once on return
      Given Alice is hosting a space
      And Bob joined before losing the connection without hearing they joined
      When the connection comes back
      Then Bob is in the space
      And Alice sees Bob once in the space's presence
