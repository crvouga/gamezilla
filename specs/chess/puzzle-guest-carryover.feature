@domain:chess
Feature: Guest puzzle progress carries over
  A guest's puzzle progress, even progress made offline, is never lost: it
  survives the app closing, is kept when they sign in with Google, and
  reaches their other devices exactly once.

  @goal:always-true:1
  Scenario: A guest's offline solve is still there after reopening the app
    Given Alice is a guest
    And Alice is playing puzzles in their space
    And Alice has solved a puzzle while offline
    When Alice closes and reopens the app
    Then Alice's game log records that puzzle as solved
    And Alice's puzzle rating is above 1500

  @goal:social:2 @goal:always-true:10
  Scenario: Signing in keeps what a guest played offline
    Given Alice is a guest
    And Alice is playing puzzles in their space
    And Alice has solved a puzzle while offline
    And the connection has come back
    When Alice signs in with Google
    Then Alice's stats show 1 played, 1 solved, and 100% accuracy
    And Alice's game log records that puzzle as solved

  @goal:works-offline:5 @goal:always-true:2
  Scenario: A guest's offline solve reaches their other device once they sign in
    Given Alice is a guest
    And Alice is playing puzzles in their space
    And Alice has solved a puzzle while offline
    And Alice has since come back online and signed in with Google
    When Alice's account opens on another device
    Then Alice's other device shows the same puzzle rating within 30 seconds
    And Alice's other device shows 1 played, 1 solved, and 100% accuracy
