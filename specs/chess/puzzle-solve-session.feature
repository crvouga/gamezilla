@domain:chess @goal:chess-puzzles:1
Feature: A puzzle attempt survives leaving and restarting
  A puzzle in progress comes back as the same attempt when the player leaves
  it or the app closes: no free skip and no fresh start. Moving on advances
  exactly one puzzle, works without a connection, and auto-advance moves on
  by itself after a solve.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Scenario: Coming back to a puzzle left mid-attempt resumes the same attempt
    Given Alice has played a wrong move
    And Alice has left the puzzle for the chess choices
    When Alice goes back to the puzzles
    Then Alice is on the same puzzle as before
    And Alice is told the move was wrong

  Scenario: A puzzle in progress when the app closed is waiting on return
    When Alice closes and reopens the app
    And Alice returns to their space
    Then Alice is asked to find the next move within 20 seconds
    And Alice is on the same puzzle as before

  Scenario: Asking for the next puzzle twice at once moves on only once
    Given Alice has solved the puzzle
    When Alice asks for the next puzzle twice in quick succession
    Then Alice is solving the puzzle that was next in line

  Scenario: Moving on to the next puzzle works without a connection
    Given Alice has solved the puzzle
    And Alice is offline
    When Alice moves on to the next puzzle
    Then Alice is solving a different puzzle than the one before

  Scenario: Auto-advance moves on by itself after a solve
    Given Alice has puzzles set to advance 1 second after a solve
    When Alice solves the puzzle
    Then Alice is on a different puzzle than the one before within 5 seconds
    And Alice's puzzle is not solved
