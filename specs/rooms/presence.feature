@domain:rooms
Feature: Presence
  When several people share a room, each wants the room to show who is in it
  right now, so nobody mistakes someone who has dropped out for someone still
  there with them.

  Rule: Someone whose device goes offline is no longer present

    Scenario: Someone whose device goes offline is no longer shown present
      Given Alice and Bob are in a shared counter room
      When Bob's device goes offline
      Then the room shows only Alice present

  Rule: Someone who reconnects is present again

    Scenario: Someone who reconnects is shown present again
      Given Alice and Bob are in a shared counter room
      And Bob's device is offline
      When Bob reconnects
      Then the room shows Alice and Bob present
