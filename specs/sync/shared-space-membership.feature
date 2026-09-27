@domain:sync
Feature: Leave a shared space and rejoin it
  When a person comes and goes from a shared space, they want to keep the
  notes they had, stop getting new ones while away, and catch up on
  everything they missed when they rejoin.

  Background:
    Given Alice and Bob are in the shared space "Trip"

  Scenario: New notes stop reaching someone who left the shared space
    Given Bob has left the shared space "Trip"
    When Alice writes the note "Tickets" saying "gate 4"
    Then Alice sees the note "Tickets" saying "gate 4"
    And Bob does not see the note "Tickets"

  Scenario: Notes someone already had stay after they leave the shared space
    Given Alice has written the note "Hotel" saying "Main St"
    And the note "Hotel" has reached Bob
    When Bob leaves the shared space "Trip"
    Then Bob still sees the note "Hotel" saying "Main St"

  Scenario: Rejoining a shared space brings the notes missed while away
    Given Bob has left the shared space "Trip"
    And Alice has written the note "Tickets" saying "gate 4"
    When Bob joins the shared space "Trip"
    Then Bob sees the note "Tickets" saying "gate 4"
