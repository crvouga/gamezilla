@domain:sync
Feature: Notes arrive quickly
  When a person writes a note, the people it is shared with want it on their
  devices so quickly that they never notice any wait, even over slow
  connections.

  @goal:works-offline:7
  Scenario: Over slow connections a note reaches the other person within a quarter of a second
    Given Alice and Bob are in the shared space "Trip"
    And Alice and Bob have slow connections
    When Alice writes the note "Groceries" saying "milk"
    Then Bob sees the note "Groceries" within a quarter of a second
