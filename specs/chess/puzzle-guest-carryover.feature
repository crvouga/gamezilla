@domain:chess @goal:works-offline:5 @goal:always-true:1 @goal:always-true:2 @goal:social:2 @goal:always-true:10
Feature: Guest puzzle progress carries over
  A guest's puzzle progress, even progress made offline, is kept when they
  sign in with Google and reaches their other devices exactly once. The full
  rating state, including how volatile it is, travels with it.

  @regression:puzzle-profile-volatility-sync
  Scenario: An offline guest solve survives Google sign-in and reaches a second device once
    Given Alice is a guest
    And Alice is playing puzzles in their space
    Then Alice has no account
    When Alice loses the connection
    And Alice solves the puzzle
    Then Alice's device holds 1 rated attempt
    And the server holds no rated attempts for Alice
    When Alice closes and reopens the app
    Then Alice's device still holds the same puzzle rating
    And Alice's device holds 1 rated attempt
    When the connection comes back
    And Alice signs in with Google
    Then Alice's account keeps the progress they made as a guest
    And the server holds 1 rated attempt for Alice within 30 seconds
    And the server's puzzle rating for Alice matches the rating from the offline solve
    When Alice's account opens on another device
    Then Alice's other device holds 1 rated attempt within 30 seconds
    And both of Alice's devices hold the puzzle rating from the offline solve
    And both of Alice's devices hold exactly 1 rated attempt, for the solved puzzle, with full credit
