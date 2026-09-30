@domain:chess
Feature: Friends watch a puzzle
  When friends are in a host's space, they want to watch the host's puzzle as
  it happens and suggest moves, so they follow along without taking it over.

  Background:
    Given Alice and Bob are friends
    And Alice is hosting a space that Bob joined from the lobby
    And Alice is playing puzzles in their space
    And Bob is watching Alice's puzzle

  Rule: Only the host drives the puzzle, and only the host may move on

    Scenario: The host's move plays while friends watch
      When Alice plays the next move of the solution
      Then Alice is the host of the puzzle and can move pieces

    Scenario: The host drives the puzzle and the watcher only watches
      When Alice plays the next move of the solution
      Then Alice is the host of the puzzle and can move pieces
      And Bob is watching the puzzle and cannot move pieces

    Scenario Outline: A watcher trying to <attempt> the host's puzzle changes nothing
      When Bob tries to <attempt> Alice's puzzle
      Then Alice's board is unchanged
      And Alice is still asked to find the next move
      And Alice's and Bob's boards agree

      Examples:
        | attempt               |
        | play the next move of |
        | skip                  |
        | move on from          |

  Rule: Only the host is rated for the puzzle
    No counter-example: a watcher has no attempt of their own to rate.

    Scenario: Only the host is rated for a watched solve
      When Alice solves the puzzle
      Then Alice's game log records that puzzle as solved
      And Bob's game log is empty within 15 seconds
      And Bob's puzzle rating is 1500

  Rule: A watcher's view follows the host, on the board and off it

    Scenario: A watcher sees the host's puzzle solved
      When Alice solves the puzzle
      Then Bob sees the puzzle solved within 15 seconds

    Scenario: A watcher's board follows each of the host's moves
      When Alice plays the next move of the solution
      Then Alice's and Bob's boards agree

    Scenario: Leaving the puzzle takes the watcher off the board too
      When Alice leaves the puzzle for the chess choices
      Then Alice has no puzzle on the board
      And Bob has no puzzle on the board
      And Bob is not offered a puzzle of his own

  Rule: A suggestion is seen, and the host's move clears it

    Scenario: A watcher's suggestion shows to host and watcher without moving the puzzle
      When Bob suggests a move that is not the solution
      Then Alice and Bob both see only Bob's suggestion
      And Alice is still asked to find the next move

    Scenario: The host's move clears the watcher's suggestion
      Given Bob has suggested a move that Alice can see
      When Alice plays the next move of the solution
      Then Bob sees no suggestions within 15 seconds
