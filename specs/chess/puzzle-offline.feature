@domain:chess @goal:works-offline:2
Feature: Puzzles offline
  A device that goes offline before it ever had puzzles says they need a
  connection instead of waiting forever, and recovers by itself once the
  connection is back.

  Background:
    Given Alice is signed in

  Scenario: Offline with no puzzles on the device, Alice is told puzzles need a connection
    Given Alice went offline before any puzzles reached their device
    When Alice opens puzzles in their space
    Then Alice is told puzzles need a connection within 15 seconds
    And Alice has no puzzle on the board

  Scenario: Reconnecting brings a puzzle to an empty offline feed
    Given Alice went offline before any puzzles reached their device
    And Alice has opened puzzles in their space
    When the connection comes back
    Then Alice has a puzzle on the board within 30 seconds
