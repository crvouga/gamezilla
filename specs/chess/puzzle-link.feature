@domain:chess
Feature: Share a puzzle link
  When a solver finds a puzzle worth showing someone, they want to share a
  puzzle link to it, so the other person can try exactly that puzzle.

  Rule: A solver can share a puzzle link to the puzzle on their board, finished or not
    No counter-example: any puzzle on the solver's board can be shared.

    Background:
      Given Alice is signed in
      And Alice is playing puzzles in their space

    Scenario: A solver shares a puzzle link to the puzzle they are solving
      When Alice shares a puzzle link
      Then Alice has a puzzle link to the puzzle on their board

    Scenario: A solver shares a puzzle link to a puzzle they have finished
      Given Alice has solved the puzzle
      When Alice shares a puzzle link
      Then Alice has a puzzle link to the puzzle on their board

    Scenario: Sharing a puzzle link again shares the same puzzle link
      Given Alice has shared a puzzle link to the puzzle on their board
      When Alice shares a puzzle link
      Then Alice has the same puzzle link as before

  Rule: Opening a puzzle link puts that exact puzzle on the board, rated only if it is the person's first attempt

    Background:
      Given Alice has shared a puzzle link to the hook-mate puzzle
      And Bob is signed in

    Scenario: Opening a puzzle link to an unplayed puzzle starts a rated attempt
      When Bob opens Alice's puzzle link
      Then Bob has the hook-mate puzzle on their board
      And Bob's attempt is rated

    Scenario: Opening a puzzle link to a puzzle already played is unrated
      Given Bob has solved the hook-mate puzzle
      When Bob opens Alice's puzzle link
      Then Bob has the hook-mate puzzle on their board
      And Bob is told the attempt is unrated

    Scenario: Opening a puzzle link while offline tells the person puzzles need a connection
      Given Bob is offline
      When Bob opens Alice's puzzle link
      Then Bob is told puzzles need a connection within 15 seconds

  Rule: A retired puzzle's link no longer opens it
    No counter-example: once a puzzle is retired, nothing a person does opens it from its puzzle link.

    Scenario: Opening a retired puzzle's link tells the person it is no longer available
      Given Alice has shared a puzzle link to the hook-mate puzzle
      And the puzzle has since been retired
      And Bob is signed in
      When Bob opens Alice's puzzle link
      Then Bob is told the puzzle is no longer available

  Rule: A guest opening a puzzle link uses one puzzle start, and past the daily puzzle limit is asked to sign in

    Background:
      Given Alice has shared a puzzle link to the hook-mate puzzle

    Scenario: A guest's puzzle link uses one of today's puzzle starts
      Given Bob is a guest who has played 19 puzzles today
      When Bob opens Alice's puzzle link
      Then Bob has the hook-mate puzzle on their board
      And Bob can read that 0 rated puzzles remain today

    Scenario: Opening the same puzzle link again uses no further puzzle start
      Given Bob is a guest who has played 18 puzzles today
      And Bob has opened Alice's puzzle link
      When Bob opens Alice's puzzle link
      Then Bob is still asked to find the next move
      And Bob can read that 1 rated puzzles remain today

    Scenario: A guest past the daily puzzle limit cannot open a puzzle link to an unplayed puzzle and is asked to sign in
      Given Bob is a guest who has finished today's last allowed puzzle
      And Bob has never played the hook-mate puzzle
      When Bob opens Alice's puzzle link
      Then Bob is told no new puzzle can start because today's allowance is used within 15 seconds
      And Bob is asked to sign in
