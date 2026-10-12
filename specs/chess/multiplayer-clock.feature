@domain:chess
Feature: The multiplayer clock
  When two people play at a time control, they want each side's time kept
  fairly and shown to both of them, so a game ends when someone runs out of
  time.

  Rule: Outside a daily game, each side starts with the time control's minutes, and neither multiplayer clock runs until both people have made their first move

    Scenario: Waiting for White's first move costs nobody any time
      Given Alice is White and Bob is Black in a new 1+0 multiplayer game
      When 20 seconds pass in multiplayer chess
      Then both people see 60 seconds on White's multiplayer clock and 60 seconds on Black's

    Scenario: White's multiplayer clock runs once both people have moved
      Given Alice is White and Bob is Black in a 1+0 multiplayer game after e4 and e5
      When 20 seconds pass in multiplayer chess
      Then both people see 40 seconds on White's multiplayer clock and 60 seconds on Black's

  Rule: Only the side to move spends time, and a legal move adds the increment to the person who made it

    Background:
      Given Alice is White and Bob is Black in a 2+1 multiplayer game after e4 and e5

    Scenario: White's legal move adds the increment to White
      Given 5 seconds have passed in multiplayer chess
      When Alice plays g1 to f3 as a multiplayer move
      Then both people see 116 seconds on White's multiplayer clock and 120 seconds on Black's

    Scenario: A move out of turn earns no increment
      When Bob plays d7 to d5 as a multiplayer move
      Then Bob is told it is not his multiplayer turn
      And both people see 120 seconds on White's multiplayer clock and 120 seconds on Black's

  Rule: Running out of time loses, even if a move arrives at that moment

    Background:
      Given Alice is White and Bob is Black in a 1+0 multiplayer game after e4 and e5

    Scenario: White runs out of time and loses the multiplayer game
      When 60 seconds pass in multiplayer chess
      Then both people see Bob won the multiplayer game because White ran out of time

    Scenario: A move at the moment White runs out of time is refused
      Given White's multiplayer clock has run out
      When Alice plays g1 to f3 as a multiplayer move
      Then Alice is told the multiplayer game is over
      And both people see Bob won the multiplayer game because White ran out of time

  Rule: Running out of time ends in a multiplayer draw when the multiplayer opponent cannot checkmate by any series of legal moves

    Scenario: Running out of time against a bare king ends in a multiplayer draw
      Given Bob has only his king left as Black in his 1+0 multiplayer game with Alice
      And Alice has 1 second left on White's multiplayer clock on her turn
      When 1 seconds pass in multiplayer chess
      Then both people see the multiplayer game is drawn by White running out of time against a bare king

    Scenario: Running out of time against a king and knight still loses
      Given Bob has only his king and a knight left as Black in his 1+0 multiplayer game with Alice
      And Alice has 1 second left on White's multiplayer clock on her turn
      When 1 seconds pass in multiplayer chess
      Then the multiplayer game is still won by Bob because White ran out of time

  Rule: A disconnected person's multiplayer clock keeps running on their turn

    Background:
      Given Alice is White and Bob is Black in a 1+0 multiplayer game after e4 and e5
      And Alice's phone is offline

    Scenario: Being offline on one's turn can still run out of time
      When 60 seconds pass in multiplayer chess
      Then Bob sees he won the multiplayer game because White ran out of time

    Scenario: Being offline with time left does not end the game
      When 20 seconds pass in multiplayer chess
      Then the multiplayer game is still unfinished
