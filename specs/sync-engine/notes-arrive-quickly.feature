@domain:sync-engine
Feature: Notes arrive quickly
  When a person writes a note, the people it is shared with want it on their
  devices within moments, so they can work together without a noticeable
  wait even over slow connections.

  Rule: A shared note reaches the other people within moments

    Scenario: Over slow connections a note reaches the other person within a quarter of a second
      Given Alice and Bob are in the shared space "Trip"
      And Alice and Bob have slow connections
      When Alice writes the note "Groceries" saying "milk"
      Then Bob sees the note "Groceries" within a quarter of a second

    Scenario: Over slow connections nearly every note reaches the other person within a fifth of a second
      Given Alice and Bob are in the shared space "Trip"
      And Alice and Bob have slow connections
      When Alice writes 20 notes one after another
      Then at least 19 of the 20 notes reach Bob within a fifth of a second each
