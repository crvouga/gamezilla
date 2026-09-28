@domain:room
Feature: Who is in the room
  When people share a room, each wants to see who is in it right now, so
  nobody mistakes someone who has gone offline for someone still there with
  them.

  Background:
    Given Alice and Bob are in the room

  Rule: The room shows present only the people who are online in it
    No counter-example: presence follows each person's connection; nobody can hide it or fake it.

    Scenario: Someone who goes offline is no longer shown present
      When Bob goes offline
      Then the room shows only Alice present

    Scenario: Someone who comes back online is shown present again
      Given Bob is offline
      When Bob comes back online
      Then the room shows Alice and Bob present
