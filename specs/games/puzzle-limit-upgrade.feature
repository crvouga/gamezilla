@domain:games
Feature: The daily puzzle limit is an invitation
  When a guest reaches the daily puzzle limit, they want a clear invitation
  to sign in rather than an error, so they know how to keep playing: a free
  account has no daily limit.

  Rule: Reaching the daily puzzle limit invites a guest to sign in
    No counter-example: Every guest at the limit is offered the same account unlock.

    Scenario: A guest at the daily limit is invited to sign in, never shown an error
      Given Alice is a guest who has finished today's last allowed puzzle
      When Alice asks for another puzzle
      Then Alice is told no new puzzle can start because today's allowance is used within 15 seconds
      And Alice is invited to sign in for more puzzles
