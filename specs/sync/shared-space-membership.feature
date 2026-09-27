@domain:sync
Feature: Leave and rejoin a shared space
  People come and go from shared spaces. Leaving stops new notes from
  arriving but takes nothing away, and coming back catches up on everything
  that was missed.

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
