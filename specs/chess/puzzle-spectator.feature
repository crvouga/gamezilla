@domain:chess @goal:chess-puzzles:12 @goal:always-true:7
Feature: Friends watch a puzzle
  People in a space see the host's board and moves live. Only the host
  drives the puzzle and only the host is rated for it; a watcher may
  suggest a move, the host sees the suggestion, and the host's next move
  clears it. Every watcher's board matches the host's.

  Background:
    Given Alice and Bob are friends
    And Alice is hosting a space that Bob joined from the lobby
    And Alice is playing puzzles in their space
    And Bob is watching Alice's puzzle

  Scenario: A watcher sees the host's puzzle solved
    When Alice solves the puzzle
    Then Bob sees the puzzle solved within 15 seconds

  Scenario: Only the host is rated for a watched solve
    When Alice solves the puzzle
    And Alice opens their stats
    Then Alice's game log records that puzzle as solved
    And Bob's game log is empty within 15 seconds
    And Bob's puzzle rating is 1500

  Scenario: The host drives the puzzle and the watcher only watches
    Then Alice is the host of the puzzle and can move pieces
    And Bob is watching the puzzle and cannot move pieces

  Scenario: A watcher's suggestion reaches the host
    When Bob suggests a move that is not the solution
    Then Alice is still solving the puzzle
    And Alice sees Bob's suggested move within 15 seconds
    And Alice sees exactly 1 suggestion

  Scenario: The host's move clears the watcher's suggestion
    Given Bob has suggested a move that Alice can see
    When Alice solves the puzzle
    Then Bob sees no suggestions within 15 seconds

  Scenario: A watcher is refused when trying to move or skip the host's puzzle
    When Bob tries to play the host's next move
    Then Bob is refused as not allowed
    When Bob tries to skip the puzzle
    Then Bob is refused as not allowed
    And Alice is still solving the puzzle
    And Alice's and Bob's boards agree

  Scenario: Host and watcher both see the watcher's suggestion
    When Bob suggests a move
    Then Alice's and Bob's boards agree
    And Alice and Bob both see only Bob's suggestion

  Scenario: The host's move clears suggestions and the watcher's board matches the host's
    Given Bob has suggested a move that Alice can see
    When Alice plays the next move of the solution
    Then Alice's and Bob's boards agree
    And Bob sees no suggestions
