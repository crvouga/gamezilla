@domain:chess @goal:works-offline:2
Feature: Puzzles offline
  When a device goes offline before it ever had puzzles, a solver wants to be
  told that puzzles need a connection instead of waiting forever, so they
  know why; puzzles arrive by themselves once the connection is back.

  Background:
    Given Alice is signed in

  Scenario: Offline with no puzzles on the device, Alice is told puzzles need a connection
    Given Alice went offline before any puzzles reached their device
    When Alice opens puzzles in their space
    Then Alice is told puzzles need a connection within 15 seconds
    And Alice has no puzzle on the board

  Scenario: Coming back online brings a puzzle to an empty offline feed
    Given Alice went offline before any puzzles reached their device
    And Alice has opened puzzles in their space
    When the connection comes back
    Then Alice has a puzzle on the board within 30 seconds
