@domain:chess
Feature: The daily rated puzzle allowance
  When a guest reaches the daily puzzle limit, they want to finish the puzzle
  on the board and know how to carry on. A guest may start 20 rated puzzles a
  day. Reaching the limit mid-puzzle lets that puzzle finish; the next one
  does not start, and signing in lifts the limit and carries on where the
  guest stopped. Going back to a puzzle already started, after
  leaving the puzzle or closing the app, never uses another of the day's
  puzzle starts.

  Scenario: A guest's twentieth puzzle of the day still starts
    Given Alice is a guest who has played 19 puzzles today
    When Alice moves on to the next puzzle
    Then Alice has a puzzle on the board
    And Alice is not shown the puzzle limit

  Scenario: The puzzle on the board can still be finished once the limit is reached
    Given Alice is a guest who reached today's puzzle limit while solving a puzzle
    When Alice solves the puzzle
    Then Alice's puzzle is solved
    And Alice is not shown the puzzle limit

  Scenario: The next puzzle past the limit does not start
    Given Alice is a guest who has finished today's last allowed puzzle
    When Alice asks for another puzzle
    Then Alice is shown the puzzle limit within 15 seconds
    And Alice has no puzzle on the board

  Scenario: Signing in lifts the limit and a puzzle is ready again
    Given Alice is a guest who has been shown today's puzzle limit
    When Alice signs in with Google
    And Alice goes back to the puzzles
    Then Alice has a puzzle on the board within 30 seconds
    And Alice is not shown the puzzle limit

  Scenario: Going back to a puzzle unfinished at the limit uses no further start
    Given Alice is a guest who reached today's puzzle limit while solving a puzzle
    And Alice has left the puzzle for the chess choices
    When Alice goes back to the puzzles
    Then Alice is on the same puzzle as before
    And Alice is still asked to find the next move
    And Alice is not shown the puzzle limit

  Scenario: A puzzle open at the limit when the app closed is waiting on return
    Given Alice is a guest who reached today's puzzle limit while solving a puzzle
    When Alice closes and reopens the app
    And Alice returns to their space
    Then Alice is asked to find the next move within 20 seconds
    And Alice is on the same puzzle as before
    And Alice is not shown the puzzle limit
