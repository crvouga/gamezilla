@domain:chess @goal:works-offline:2 @goal:always-true:1
Feature: Puzzles offline
  A device that goes offline before it ever had puzzles says so instead of
  waiting forever, and recovers by itself once the connection is back. What
  is played offline reaches the server exactly once.

  Background:
    Given Alice is signed in

  Scenario: Offline with no puzzles on the device, the player is told the feed is empty
    When Alice creates a space
    And Alice loses the connection
    And Alice opens puzzles in their space without waiting for a puzzle
    Then Alice is told the feed is empty within 15 seconds
    And Alice has no puzzle on the board

  Scenario: Reconnecting brings a puzzle to an empty offline feed
    Given Alice's feed is empty because they went offline before any puzzles arrived
    When the connection comes back
    Then Alice has a puzzle on the board within 30 seconds

  Scenario: A wrong move made offline reaches the server exactly once
    Given Alice is playing puzzles in their space
    When Alice loses the connection
    And Alice plays a wrong move
    Then Alice's device records 1 wrong move on that puzzle
    When the connection comes back
    Then the server records 1 wrong move by Alice on that puzzle within 30 seconds
