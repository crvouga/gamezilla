@domain:chess
Feature: The daily rated puzzle allowance
  When a guest reaches the daily puzzle limit, they want to finish the puzzle
  on the board and know how to carry on, so the limit never costs them a
  puzzle they already started.

  Rule: A guest starts at most 20 rated puzzles a day

    Scenario: A guest's twentieth puzzle of the day still starts
      Given Alice is a guest who has played 19 puzzles today
      When Alice moves on to the next puzzle
      Then Alice has a puzzle on the board
      And Alice is not shown the puzzle limit

    Scenario: The next puzzle past the limit does not start
      Given Alice is a guest who has finished today's last allowed puzzle
      When Alice asks for another puzzle
      Then Alice is told no new puzzle can start because today's allowance is used within 15 seconds
      And Alice has no puzzle on the board

  Rule: Reaching the limit mid-puzzle lets that puzzle finish
    No counter-example: the next puzzle past the limit is the first rule's refusal.

    Scenario: The puzzle on the board can still be finished once the limit is reached
      Given Alice is a guest who reached today's puzzle limit while solving a puzzle
      When Alice solves the puzzle
      Then Alice's puzzle is solved
      And Alice is not shown the puzzle limit

  Rule: Signing in lifts the daily puzzle limit
    No counter-example: a guest who has not signed in is the first rule's refusal.

    Scenario: Signing in lifts the limit and a puzzle is ready again
      Given Alice is a guest who has been shown today's puzzle limit
      And Alice is signed in with Google
      When Alice goes back to the puzzles
      Then Alice has a puzzle on the board within 30 seconds
      And Alice is not shown the puzzle limit

  Rule: Going back to a puzzle already started never uses another puzzle start

    Scenario: Going back to a puzzle unfinished at the limit uses no further start
      Given Alice is a guest who reached today's puzzle limit while solving a puzzle
      And Alice has left the puzzle for the chess choices
      When Alice goes back to the puzzles
      Then Alice is on the same puzzle as before
      And Alice is still asked to find the next move
      And Alice is not shown the puzzle limit

    Scenario: A puzzle open at the limit when the app closed is waiting on return
      Given Alice is a guest who reached today's puzzle limit while solving a puzzle
      And Alice has closed and reopened the app
      When Alice returns to their space
      Then Alice is asked to find the next move within 20 seconds
      And Alice is on the same puzzle as before
      And Alice is not shown the puzzle limit

    Scenario: Going back after the puzzle is over does not save a puzzle start for later
      Given Alice is a guest who has finished today's last allowed puzzle
      And Alice has left the puzzle for the chess choices
      When Alice goes back to the puzzles
      Then Alice is told no new puzzle can start because today's allowance is used within 15 seconds
      And Alice has no puzzle on the board

  Rule: The remaining daily allowance is visible while solving
    No counter-example: A limited allowance always tells the solver how many rated puzzles remain today.

    Scenario: Starting a puzzle shows the remaining allowance
      Given Alice is a guest
      And Alice is hosting a space
      When Alice opens puzzles in their space
      Then Alice can read that 19 rated puzzles remain today

    @regression:puzzle-allowance-no-readable-count
    Scenario: Retrying uses none of the remaining allowance
      Given Alice is a guest
      And Alice is playing puzzles in their space
      And Alice has played a wrong move
      When Alice retries the puzzle
      Then Alice can read that 19 rated puzzles remain today
