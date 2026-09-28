@domain:room
Feature: Timed match
  When White and Black play a timed match in the room, each wants the match
  clock to run down only the time of the player to move and the match to be
  over the moment it runs out, so nobody can win by claiming it early or
  escape losing by going offline.

  Rule: A match starts only once

    Scenario: Starting a match gives each player their time with White to move
      Given White and Black are in the room
      When White starts a match with 10 seconds for White and 8 seconds for Black
      Then White is to move
      And White has 10 seconds left and Black has 8 seconds left

    Scenario: A match that is playing cannot be started again
      Given White and Black have started a match with 10 seconds for White and 10 seconds for Black
      And 3 seconds have passed
      When Black starts a match with 20 seconds for White and 20 seconds for Black
      Then the match is still playing with White to move
      And White has 7 seconds left and Black has 10 seconds left

    Scenario: A match that is over cannot be started again
      Given White and Black have started a match with 4 seconds for White and 4 seconds for Black
      And 5 seconds have passed
      When White starts a match with 10 seconds for White and 10 seconds for Black
      Then White and Black still see Black win on time

  Rule: The player whose time runs out loses on time

    Scenario: White loses on time when White's time runs out
      Given White and Black have started a match with 5 seconds for White and 8 seconds for Black
      When 6 seconds pass
      Then White and Black both see Black win on time

    Scenario: The match plays on while the player to move has time left
      Given White and Black have started a match with 5 seconds for White and 8 seconds for Black
      When 4 seconds pass
      Then the match is still playing with White to move
      And White has 1 second left and Black has 8 seconds left

    Scenario: Black loses on time when Black's own time runs out
      Given White and Black have started a match with 10 seconds for White and 10 seconds for Black
      And White has moved after 3 seconds
      When 11 seconds pass
      Then White and Black both see White win on time

  Rule: The match clock runs only the time of the player to move
    No counter-example: the match clock runs by itself; nobody can make it run for the wrong player.

    Scenario: White's time stands still while Black is to move
      Given White and Black have started a match with 10 seconds for White and 10 seconds for Black
      And White has moved after 3 seconds
      When 4 seconds pass
      Then White has 7 seconds left and Black has 6 seconds left

  Rule: Only the player to move can move, and only while the match is playing

    Scenario: A move keeps the mover's time left and passes the clock to the opponent
      Given White and Black have started a match with 10 seconds for White and 10 seconds for Black
      And 3 seconds have passed
      When White moves
      Then Black is to move
      And White has 7 seconds left and Black has 10 seconds left

    Scenario: Black cannot move while White is to move
      Given White and Black have started a match with 10 seconds for White and 10 seconds for Black
      When Black moves
      Then the match is still playing with White to move

    Scenario: Nobody can move before the match starts
      Given White and Black are in the room
      When White moves
      Then the match has still not started

    Scenario: A move after the mover has run out of time is too late
      Given White and Black have started a match with 4 seconds for White and 4 seconds for Black
      And White has been offline for 5 seconds
      When White moves
      Then White is told the move came too late

  Rule: Whoever runs out of time while offline sees the result once back online
    No counter-example: the match clock keeps running for everyone, online or not.

    Scenario: White sees the result once back online after running out of time
      Given White and Black have started a match with 4 seconds for White and 4 seconds for Black
      And White has been offline for 5 seconds
      When White comes back online
      Then White and Black both see Black win on time

  Rule: Claiming the opponent has run out of time changes nothing until they have

    Scenario: A claim before the opponent's time has run out changes nothing
      Given White and Black have started a match with 8 seconds for White and 8 seconds for Black
      When Black claims White has run out of time
      Then the match is still playing with White to move

    Scenario: The match is still won on time after an early claim
      Given White and Black have started a match with 8 seconds for White and 8 seconds for Black
      And Black has claimed White has run out of time
      When 9 seconds pass
      Then White and Black both see Black win on time
