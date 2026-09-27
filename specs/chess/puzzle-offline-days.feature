@domain:chess @goal:works-offline:2 @goal:works-offline:3 @goal:works-offline:4
Feature: Days of puzzles without a connection
  Once a player has puzzles on their device they can keep playing for days
  with no connection: no errors, no blocked screens, and nothing lost or
  counted twice when the connection comes back.

  Background:
    Given Alice is signed in
    And Alice is also signed in on another device
    And Alice is playing puzzles in their space
    And Alice is offline

  Scenario: Three days offline still leaves a puzzle to play
    When Alice solves 10 puzzles a day for 3 days
    Then Alice has a puzzle on the board
    And Alice is not told the feed is empty

  Scenario: Three days of offline play all count once the connection comes back
    Given Alice has solved 10 puzzles a day for 3 days
    When the connection comes back
    Then Alice's stats show 30 played, 30 solved, and 100% accuracy
    And Alice's other device shows 30 played, 30 solved, and 100% accuracy
