@domain:chess @goal:chess-puzzles:8
Feature: Puzzle rating
  Each player has a running puzzle rating that moves after every rated
  puzzle, online or offline. A new player starts at 1500 and is marked
  provisional ("1500?") until their rating deviation settles below the
  threshold. The server's value is authoritative: every device converges on
  it, and each puzzle moves the rating at most once, ever.

  Scenario: A new player starts at 1500, provisional
    Given the puzzle pool holds puzzles rated near 1500
    And Alice is signed in
    And Alice is playing puzzles in their space
    Then Alice's stats show a rating of "1500?"
    And the server holds no puzzle rating for Alice

  Scenario: A solve raises the rating by exactly what the rating formula gives
    Given the puzzle pool holds puzzles rated near 1500
    And Alice is signed in
    And Alice is playing puzzles in their space
    When Alice solves the puzzle
    Then the server holds 1 rated attempt for Alice within 30 seconds
    And Alice's server rating is above 1500
    And Alice's server rating deviation is below the starting deviation
    And Alice's server rating is exactly the rating formula's result for a win against that puzzle

  Scenario: A fail after a solve lowers the rating and narrows the deviation further
    Given the puzzle pool holds puzzles rated near 1500
    And Alice is signed in
    And Alice is playing puzzles in their space
    And Alice has solved one puzzle and the server has rated it
    When Alice moves on to the next puzzle
    And Alice plays a wrong move
    Then the server holds 2 rated attempts for Alice within 30 seconds
    And Alice's server rating is below what it was after the solve
    And Alice's server rating deviation is below what it was after the solve

  Scenario: The provisional marker clears once the deviation settles
    Given the puzzle pool holds puzzles rated near 1500
    And Alice is signed in
    And Alice is playing puzzles in their space
    When Alice alternately solves and skips puzzles until their rating is no longer provisional
    Then each puzzle Alice attempted was rated at most once
    And Alice's server rating is not provisional
    And Alice's stats show their server rating with no provisional marker

  Scenario: An offline solve moves the rating on the device at once
    Given the puzzle pool holds puzzles rated near 1500
    And Alice is signed in
    And Alice is playing puzzles in their space
    When Alice loses the connection
    And Alice solves the puzzle
    Then Alice's device rating is above 1500
    And the server holds no puzzle rating for Alice

  Scenario: An offline solve reconciles to the server value and never double-applies
    Given the puzzle pool holds puzzles rated near 1500
    And Alice is signed in
    And Alice is playing puzzles in their space
    When Alice loses the connection
    And Alice solves the puzzle
    And the connection comes back
    Then the server holds 1 rated attempt for Alice within 30 seconds
    And Alice's server rating is exactly the rating formula's result for a win against that puzzle
    And Alice's device rating matches the server within 30 seconds
    And Alice's device holds 1 rated attempt

  Scenario: A repeat attempt on an already-rated puzzle leaves the rating alone
    Given the puzzle pool holds the three standard puzzles
    And Alice is signed in
    And Alice is playing puzzles in their space
    When Alice solves every puzzle in the pool
    Then the server holds 3 rated attempts for Alice within 30 seconds
    When Alice moves on to the next puzzle
    Then Alice's feed comes round to a puzzle they already played within 30 seconds
    And Alice's current attempt is unrated
    When Alice solves the puzzle
    Then the server holds 3 rated attempts for Alice
    And Alice's server rating and deviation are unchanged by the repeat

  Scenario: Two devices of one account converge on a single rating
    Given the puzzle pool holds puzzles rated near 1500
    And Alice is signed in
    And Alice is playing puzzles in their space
    When Alice solves the puzzle
    And Alice moves on to the next puzzle
    And Alice solves the puzzle
    Then the server holds 2 rated attempts for Alice within 30 seconds
    When Alice's account opens on another device
    Then Alice's other device shows the server rating within 30 seconds
    And both of Alice's devices hold the server's rating and deviation
    And both of Alice's devices hold 2 rated attempts
