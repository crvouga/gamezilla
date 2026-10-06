@domain:chess
Feature: A multiplayer game stays as it ended
  When a multiplayer game is over or aborted, both people want it kept
  exactly as it ended, so only a multiplayer rematch or a new opponent can
  follow it.

  Rule: No move is accepted once a multiplayer game is over or aborted

    Scenario: A game drawn by agreement keeps its board and moves on another device
      Given Alice's 5+0 multiplayer game with Bob was drawn by agreement after e4 and e5
      When Alice opens multiplayer chess on another device
      Then Alice sees the multiplayer game is drawn by agreement
      And Alice sees the multiplayer move list "1. e4 e5"

    Scenario: No move is accepted after a draw by agreement
      Given Alice's 5+0 multiplayer game with Bob was drawn by agreement after e4 and e5
      When Alice plays g1 to f3 as a multiplayer move
      Then Alice is told the multiplayer game is over
      And both people still see the multiplayer move list "1. e4 e5"

    Scenario: No move is accepted in an aborted game
      Given Alice's 5+0 multiplayer game with Bob was aborted
      When Alice plays e2 to e4 as a multiplayer move
      Then Alice is told the multiplayer game is over
      And both people still see the multiplayer game was aborted

  Rule: Once a multiplayer game is over or aborted, its people cannot resign, abort or offer a multiplayer draw, but can find a new opponent

    Scenario: A person can find a new opponent after a draw by agreement
      Given Alice's 5+0 multiplayer game with Bob was drawn by agreement after e4 and e5
      When Alice finds a new opponent
      Then Alice is looking for a 5+0 chess opponent

    Scenario: A won game offers no resigning, aborting or draw offer
      Given Bob resigned multiplayer chess and Alice won
      When Alice opens multiplayer chess
      Then Alice cannot resign multiplayer chess, abort the multiplayer game or offer a multiplayer draw

    Scenario: A game drawn by agreement offers no resigning, aborting or draw offer
      Given Alice's 5+0 multiplayer game with Bob was drawn by agreement after e4 and e5
      When Alice opens multiplayer chess
      Then Alice cannot resign multiplayer chess, abort the multiplayer game or offer a multiplayer draw

    Scenario: An aborted game offers no resigning, aborting or draw offer
      Given Alice's 5+0 multiplayer game with Bob was aborted
      When Alice opens multiplayer chess
      Then Alice cannot resign multiplayer chess, abort the multiplayer game or offer a multiplayer draw

    Scenario: A person who has never played has no multiplayer game to act on
      Given Alice has a free account and has never played a multiplayer game
      When Alice opens multiplayer chess
      Then Alice cannot resign multiplayer chess, abort the multiplayer game or offer a multiplayer draw
      And Alice cannot find a new opponent or offer a multiplayer rematch
