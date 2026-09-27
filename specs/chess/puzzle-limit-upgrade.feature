@domain:chess @goal:guest-free-and-paid:6
Feature: The daily puzzle limit is an invitation
  When a guest reaches the daily puzzle limit, they want a clear invitation
  to sign in rather than an error, so they know how to keep playing: a free
  account has no daily limit.

  Scenario: A guest at the daily limit is invited to sign in, never shown an error
    Given Alice is a guest who has finished today's last allowed puzzle
    When Alice asks for another puzzle
    Then Alice is shown the puzzle limit within 15 seconds
    And Alice is invited to sign in for more puzzles
