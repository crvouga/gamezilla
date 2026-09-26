@domain:chess
Feature: The daily rated puzzle allowance
  A guest may start 20 rated puzzles a day. Each start uses one unit of the
  allowance, and no start is ever charged twice. The server never records
  more starts in one day than the allowance. Reaching the limit mid-puzzle
  lets that puzzle finish; the next start is denied and never charged.
  Signing in lifts the limit and keeps the same progress.

  Scenario: Starting a puzzle uses one unit of the day's allowance
    Given Alice is a guest
    When Alice creates a space
    And Alice opens puzzles in their space
    Then Alice's device has used 1 puzzle start today
    And the server records 1 puzzle start for Alice
    And no puzzle start is charged twice for Alice

  Scenario: The puzzle on the board completes when the limit is reached mid-puzzle
    Given Alice is a guest who reached today's puzzle limit while solving a puzzle
    When Alice solves the puzzle
    Then Alice is still on the same puzzle
    And Alice is not shown the puzzle limit
    And no puzzle start is charged twice for Alice
    And the server records no more than 20 puzzle starts for Alice in a day

  Scenario: The next start past the limit is denied
    Given Alice is a guest who reached today's puzzle limit while solving a puzzle
    When Alice solves the puzzle
    And Alice moves on to the next puzzle without waiting for it
    Then Alice is shown the puzzle limit within 15 seconds
    And Alice has no puzzle on the board
    And Alice's device has used 20 puzzle starts today
    And no puzzle start is charged twice for Alice
    And the server records no more than 20 puzzle starts for Alice in a day

  Scenario: A denied start is never charged
    Given Alice is a guest who reached today's puzzle limit while solving a puzzle
    When Alice solves the puzzle
    And Alice moves on to the next puzzle without waiting for it
    Then Alice is shown the puzzle limit within 15 seconds
    When 2 seconds pass
    Then the server records 20 puzzle starts for Alice
    And no puzzle start is charged twice for Alice
    And the server records no more than 20 puzzle starts for Alice in a day

  Scenario: Signing in lifts the limit and the feed starts the next puzzle by itself
    Given Alice is a guest who reached today's puzzle limit while solving a puzzle
    When Alice solves the puzzle
    And Alice moves on to the next puzzle without waiting for it
    Then Alice is shown the puzzle limit within 15 seconds
    When Alice signs in with Google
    And Alice goes back to the puzzles
    Then Alice has a puzzle on the board within 30 seconds
    And Alice is not shown the puzzle limit
    And no puzzle start is charged twice for Alice
