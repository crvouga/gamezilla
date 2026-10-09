@domain:chess
Feature: Being matched for multiplayer chess
  When a person is looking for a chess opponent, they want to see how the
  search is going and who they will play, so a game never starts as a
  surprise.

  Rule: A person looking for a chess opponent sees their time control and how long they have been looking
    No counter-example: every search shows its time control and how long it has run, so there is nothing to refuse.

    Scenario: A search shows its time control and how long it has run
      Given Alice is looking for a 5+0 chess opponent
      When 40 seconds pass in multiplayer chess
      Then Alice sees she has been looking for a 5+0 chess opponent for 40 seconds

  Rule: A matched person sees their multiplayer opponent's username and multiplayer rating, the time control and their colour

    Scenario: Each matched person sees who they play, how fast and as which colour
      Given Bob has a blitz rating of 1620
      And Alice and Bob are looking for 3+2 chess opponents
      When a matchmaking match is formed for Alice and Bob
      Then Alice sees Bob as their multiplayer opponent at 3+2, with a blitz rating of "1620" and their colour
      And Bob sees Alice as their multiplayer opponent at 3+2, with a blitz rating of "1500?" and their colour

    Scenario: A person who is still looking is shown no multiplayer opponent
      Given Alice is the only person looking for a 3+2 chess opponent
      When matchmaking pairs people up
      Then Alice is still looking for a chess opponent
      And Alice is not shown a multiplayer opponent
