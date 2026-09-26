@domain:chess @goal:chess-puzzles:5
Feature: A puzzle attempt survives leaving and restarting
  A puzzle in progress stays pending when the player leaves it or the app is
  killed, and comes back as the same attempt: no free skip, no second start,
  no second charge. Moving on advances exactly one puzzle, the next puzzle is
  already chosen so moving on needs no network, and auto-advance moves on by
  itself after a solve.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: Leaving mid-attempt keeps the puzzle pending and brings it back
    When Alice plays a wrong move
    Then the puzzle's recorded outcomes are "failed"
    When Alice leaves the puzzle for the chess choices
    And Alice goes back to the puzzles
    Then Alice is on the same puzzle as before
    And Alice is told the move was wrong
    And the puzzle has been started once
    And the puzzle's recorded outcomes are still "failed"
    And Alice's device has used 1 puzzle start

  Scenario: The app killed mid-puzzle restores the same pending attempt
    Then the puzzle has been started once
    When Alice closes and reopens the app
    And Alice returns to their space
    Then Alice is solving the puzzle within 20 seconds
    And Alice is on the same puzzle as before
    And the puzzle has no recorded outcome
    And the puzzle has been started once
    And Alice's device has used 1 puzzle start
    When Alice solves the puzzle
    Then the puzzle's recorded outcomes are "solved"

  Scenario: Asking for the next puzzle twice at once advances exactly one puzzle
    When Alice solves the puzzle
    And Alice asks for the next puzzle twice in quick succession
    Then Alice is solving a different puzzle than the one before
    And Alice has started 2 puzzles in all
    And Alice's device has used 2 puzzle starts

  Scenario: The next puzzle is chosen in advance and moving on needs no network
    Then Alice's next puzzle is already chosen and differs from the current one
    When Alice solves the puzzle
    And Alice loses the connection
    And Alice asks for the next puzzle twice in quick succession
    Then Alice is solving a different puzzle than the one before
    And Alice is solving the puzzle

  Scenario: Auto-advance moves on by itself after a solve
    When Alice sets puzzles to advance 1 second after a solve
    And Alice solves the puzzle
    Then Alice is on a different puzzle than the one before within 20 seconds
    And Alice's puzzle is not solved
