@domain:friends
Feature: Profile changes reach other people
  When a person changes their username, they want their friends' lists to
  show the new one and people search to find them by it, not by the one they
  gave up, so everyone knows them by the name they chose, and never by one
  that is no longer allowed.

  Rule: A person's current username reaches their friends list and people search

    Scenario: A friend's new name appears in an open friends list
      Given Alice and Bob are friends
      And Alice is viewing their friends list with Bob in it
      When Bob renames themselves to @robert_1
      Then Alice sees @robert_1 appear in their friends list within 15 seconds
      And @bob is gone from Alice's open friends list

    Scenario: Search finds a renamed person by the new name
      Given Alice and Bob are signed in
      And Bob has renamed themselves to @robert_1
      When Alice searches for "robert_1"
      Then Alice's search shows @robert_1

    Scenario: Search no longer finds a renamed person by the old name
      Given Alice and Bob are signed in
      And Bob has renamed themselves to @robert_1
      When Alice searches for "bob"
      Then Alice's search shows nobody

  Rule: A username that is no longer allowed is never shown to or found by friends

    Background:
      Given Alice and Bob are friends
      And Bob has renamed themselves to @chess_cheater

    Scenario: A friend whose username the team stops allowing is listed under a stand-in name
      Given Alice is viewing their friends list with Bob in it
      When the team stops allowing the username @chess_cheater
      Then Alice's friends list shows Bob under a stand-in name within 15 seconds
      And Alice's friends list does not show @chess_cheater

    Scenario: Search does not find a person by a username that is no longer allowed
      Given the team has stopped allowing the username @chess_cheater
      When Alice searches for "chess_cheater"
      Then Alice cannot find Bob by @chess_cheater
