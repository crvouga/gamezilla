@domain:chess
Feature: One game record for both spaces
  When a multiplayer game is played from two spaces, its people and their
  guests want one game record, so copying it anywhere keeps the same game.

  Rule: Either space can copy the one game record once the multiplayer game is over, and an unfinished game offers it to neither

    Background:
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5

    Scenario: Resigning offers both spaces the same game record
      Given Carol is a guest watching Alice's multiplayer game
      And Dave is a guest watching Bob's multiplayer game
      When Bob resigns multiplayer chess
      Then Carol is offered the game record and the final position
      And Dave is offered the game record and the final position

    Scenario: A guest in the other space copies the same game record
      Given Dave is a guest watching Bob's multiplayer game
      And Bob has resigned multiplayer chess
      When Dave copies the game record
      Then the game record Dave copied gives the multiplayer result as 1-0, the time control as 5+0 and the moves as "1. e4 e5"

    Scenario: Another device copies the same game record
      Given Bob has resigned multiplayer chess
      And Alice is also signed in on another device
      When Alice copies the game record on another device
      Then the game record Alice copied gives the multiplayer result as 1-0, the time control as 5+0 and the moves as "1. e4 e5"

    Scenario: An unfinished multiplayer game offers the other space's guest neither
      Given Dave is a guest watching Bob's multiplayer game
      When Alice plays g1 to f3 as a multiplayer move
      Then Dave is not offered the game record or the final position
      And Dave sees the multiplayer move list "1. e4 e5 2. Nf3"

  Rule: A move from another device is recorded once

    Scenario: A move from the other device appears once in both spaces
      Given Alice and Bob have a multiplayer game in different spaces
      And Carol is a guest watching Alice's multiplayer game
      And Dave is a guest watching Bob's multiplayer game
      And Alice is also signed in on another device
      When Alice plays e2 to e4 as a multiplayer move on her other device
      Then Bob, Carol and Dave see the multiplayer move list "1. e4"

    Scenario: The phone cannot record that same move a second time
      Given Alice's multiplayer move e2 to e4 was accepted from her other device
      When Alice plays e2 to e4 as a multiplayer move on her phone
      Then Alice is told it is not her multiplayer turn
      And Bob sees the multiplayer move list "1. e4"

  Rule: Being idle adds nothing to the game record
    No counter-example: losing the connection cannot add a move, and an unfinished game offers no game record.

    Scenario: Resigning while the other person is idle records the resignation
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      And Alice has been idle for 2 minutes
      And Carol is a guest watching Alice's multiplayer game
      And Bob has resigned multiplayer chess
      When Carol copies the game record
      Then the game record Carol copied gives the multiplayer result as 1-0, the time control as 5+0 and the moves as "1. e4 e5"
