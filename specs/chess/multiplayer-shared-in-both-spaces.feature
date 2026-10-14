@domain:chess
Feature: See one multiplayer game from either space
  When two people play a multiplayer game from their own spaces, everyone
  with them wants the same game, so a guest sees what the other person sees.

  Rule: A move accepted in one space is the same move list and the same multiplayer clocks in the other

    Scenario: The other person and both guests see the move that was accepted
      Given Alice and Bob have a multiplayer game in different spaces
      And Carol is a guest watching Alice's multiplayer game
      And Dave is a guest watching Bob's multiplayer game
      When Alice plays e2 to e4 as a multiplayer move
      Then Bob, Carol and Dave see the multiplayer move list "1. e4"

    Scenario: Both spaces see the same multiplayer clocks
      Given Alice is White and Bob is Black in a 1+0 multiplayer game after e4 and e5
      And Carol is a guest watching Alice's multiplayer game
      And Dave is a guest watching Bob's multiplayer game
      When 20 seconds pass in multiplayer chess
      Then Bob, Carol and Dave see 40 seconds on White's multiplayer clock and 60 seconds on Black's

    Scenario: A guest reviewing an earlier position leaves the other space on the current game
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      And Carol is a guest watching Alice's multiplayer game
      And Dave is a guest watching Bob's multiplayer game
      When Carol chooses e4 in the multiplayer move list
      Then Bob's multiplayer board still shows the current position after e5
      And Dave sees the multiplayer move list "1. e4 e5"

  Rule: Being idle leaves both spaces on the same multiplayer game
    No counter-example: being idle never plays a move, and nobody is told the host is offline. Missing the first move aborts that same multiplayer game, and after both people have moved the multiplayer clock still runs.

    Background:
      Given Alice and Bob have a multiplayer game in different spaces
      And Carol is a guest watching Alice's multiplayer game

    Scenario: Two minutes with nothing done shows the host idle and leaves the other person's game
      When Alice stays idle for 2 minutes
      Then Carol sees Alice is idle within 20 seconds
      And Bob keeps their same multiplayer game with Alice

    Scenario: One minute in the multiplayer game is not idle
      When Alice stays idle for 1 minute
      Then Carol sees Alice is not idle within 20 seconds
      And Bob keeps their same multiplayer game with Alice

    Scenario: Losing the connection during the multiplayer game is not being idle
      When Alice loses the connection
      Then Alice is told the connection is missing within 15 seconds
      And Alice is not idle

  Rule: A missing connection does not give the other space a different game

    Scenario: The other space sees a move the offline phone does not
      Given Alice's multiplayer move e2 to e4 was accepted
      And Dave is a guest watching Bob's multiplayer game
      And Alice's phone is offline
      When Bob plays e7 to e5 as a multiplayer move
      Then Dave sees the multiplayer move list "1. e4 e5"
      And Alice's phone keeps its last known multiplayer board

    Scenario: An offline phone cannot add a move the other space would see
      Given Alice has a new multiplayer game and her phone is offline
      And Dave is a guest watching Bob's multiplayer game
      When Alice plays e2 to e4 as a multiplayer move
      Then Alice is told multiplayer moves need a connection
      And Bob keeps their same multiplayer game with Alice

    Scenario: A guest with a connection sees the move the other space sees while the host is offline
      Given Alice's multiplayer move e2 to e4 was accepted
      And Carol is a guest watching Alice's multiplayer game
      And Alice's phone is offline
      When Bob plays e7 to e5 as a multiplayer move
      Then Carol sees the multiplayer move list "1. e4 e5"
      And Carol is told the host is offline within 20 seconds

    Scenario: Another connected device of the host keeps the guest from being told the host is offline
      Given Alice and Bob have a multiplayer game in different spaces
      And Alice's other device is in the space
      And Carol is a guest watching Alice's multiplayer game
      When Alice's phone loses the connection
      Then Carol is not told the host is offline
      And Bob keeps their same multiplayer game with Alice

    Scenario: A guest who loses the connection is told, and the other person keeps the game
      Given Alice and Bob have a multiplayer game in different spaces
      And Carol is a guest watching Alice's multiplayer game
      When Carol loses the connection
      Then Carol is told the connection is missing within 15 seconds
      And Bob keeps their same multiplayer game with Alice

    Scenario: A guest whose connection comes back sees the move the other space has
      Given Carol's phone was offline when Bob's multiplayer move e7 to e5 was accepted
      When Carol's phone comes back online for multiplayer chess
      Then Carol sees the multiplayer move list "1. e4 e5"
      And Bob sees the multiplayer move list "1. e4 e5"
