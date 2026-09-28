@domain:room
Feature: Who is in the room
  When people share a room, each wants to see who is in it right now, so
  nobody mistakes someone who has gone offline for someone still there with
  them.

  Background:
    Given Alice and Bob are in the room

  Rule: The room shows present only the people whose phones are online in it
    No counter-example: presence follows each person's connection; nobody can hide it or fake it.

    Scenario: Someone whose phone goes offline is no longer shown present
      When Bob's phone goes offline
      Then the room shows only Alice present

    Scenario: Someone whose phone comes back online is shown present again
      Given Bob's phone is offline
      When Bob's phone comes back online
      Then the room shows Alice and Bob present
