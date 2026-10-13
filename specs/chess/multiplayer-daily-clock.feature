@domain:chess
Feature: The multiplayer clock in a daily game
  When two people play a daily game, they want the same days for every move,
  so nobody has to hurry and no game is held up by one person for ever.

  Rule: In a daily game the side to move has the time control's days for every move, and a move hands the full days to the other person

    Background:
      Given Alice is White and Bob is Black in a daily game at 3 days per move after e4 and e5

    Scenario: Only the side to move spends its days
      When 1 day passes in multiplayer chess
      Then both people see 2 days on White's multiplayer clock and 3 days on Black's

    Scenario: A move hands the full days to the other person and saves up none of the unused time
      Given 1 day has passed in multiplayer chess
      When Alice plays g1 to f3 as a multiplayer move
      Then both people see 3 days on White's multiplayer clock and 3 days on Black's

    Scenario: A move out of turn hands nobody the full days
      Given 1 day has passed in multiplayer chess
      When Bob plays d7 to d5 as a multiplayer move
      Then Bob is told it is not their multiplayer turn
      And both people see 2 days on White's multiplayer clock and 3 days on Black's

  Rule: A daily game's multiplayer clock runs from the start, and missing the first move aborts the daily game

    Scenario: White's days run before anybody has moved
      Given Alice is White and Bob is Black in a new daily game at 3 days per move
      When 1 day passes in multiplayer chess
      Then both people see 2 days on White's multiplayer clock and 3 days on Black's

    Scenario: White misses the first move after 1 day at 1 day per move
      Given Alice is White and Bob is Black in a new daily game at 1 day per move
      When 1 day passes in multiplayer chess
      Then both people see the multiplayer game was aborted
      And neither person's daily rating has moved

    Scenario: White still has time for the first move after 23 hours at 1 day per move
      Given Alice is White and Bob is Black in a new daily game at 1 day per move
      When 23 hours pass in multiplayer chess
      Then the multiplayer game is still unfinished

    Scenario: Black misses the first move 3 days after White's
      Given Alice's multiplayer move e2 to e4 was accepted 2 days after her daily game at 3 days per move with Bob started
      When 3 days pass in multiplayer chess
      Then both people see the multiplayer game was aborted

    Scenario: Black's days start from White's first move
      Given Alice's multiplayer move e2 to e4 was accepted 2 days after her daily game at 3 days per move with Bob started
      When 2 days pass in multiplayer chess
      Then the multiplayer game is still unfinished

  Rule: Once both people have moved in a daily game, running out of time loses, or ends in a multiplayer draw when the multiplayer opponent cannot checkmate

    Scenario: White runs out of time in a daily game and loses
      Given Alice is White and Bob is Black in a daily game at 1 day per move after e4 and e5
      When 1 day passes in multiplayer chess
      Then both people see Bob won the multiplayer game because White ran out of time

    Scenario: White still has time an hour before the day is over
      Given Alice is White and Bob is Black in a daily game at 1 day per move after e4 and e5
      When 23 hours pass in multiplayer chess
      Then the multiplayer game is still unfinished

    Scenario: A move after the days have run out is refused
      Given Alice is White and Bob is Black in a daily game at 1 day per move after e4 and e5
      And 1 day has passed in multiplayer chess
      When Alice plays g1 to f3 as a multiplayer move
      Then Alice is told the multiplayer game is over
      And both people see Bob won the multiplayer game because White ran out of time

    Scenario: Running out of time against a bare king in a daily game is a multiplayer draw
      Given Bob has only his king left as Black in his daily game at 1 day per move with Alice
      And Alice has 1 day left on White's multiplayer clock on her turn
      When 1 day passes in multiplayer chess
      Then both people see the multiplayer game is drawn by White running out of time against a bare king
