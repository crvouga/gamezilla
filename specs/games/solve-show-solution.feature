@domain:games
Feature: Showing the solution
  When a solver cannot find the line of a puzzle of the game, they want to see
  the solution played out, so they learn it. Showing the solution plays out
  the rest of the line, stops play, and counts as a fail.

  Rule: Showing the solution plays the line and keeps the attempt failed
    No counter-example: showing the solution always counts as a fail; a puzzle that is over offers no solution to show.

    Background:
      Given Alice is signed in
      And Alice is solving the game's known puzzle

    Scenario: The rest of the line plays out to its end
      When Alice shows the solution
      Then Alice's board shows the end of the line within 20 seconds

    Scenario: Showing the solution stops play
      When Alice shows the solution
      Then Alice's puzzle shows the revealed solution within 20 seconds
      And Alice cannot make a move

    Scenario: Showing the solution counts as a fail
      When Alice shows the solution
      Then Alice's game log records that puzzle as failed
      And Alice's stats show 1 played, 0 solved, and 0% accuracy

    Scenario: Showing the solution drops the rating
      When Alice shows the solution
      Then Alice's puzzle rating is below 1500
