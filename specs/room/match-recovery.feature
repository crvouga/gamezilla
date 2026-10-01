@domain:room
Feature: Timed matches keep their clocks after interruption
  When a timed match is interrupted, its players want to keep their time and
  learn who won, so a match cannot be left playing after time has run out.

  Rule: An interruption never gives a player extra time
    No counter-example: the match clock alone decides whose time runs out.

    Scenario: Returning before time runs out keeps only the time left
      Given White and Black started a match as the room became unavailable
      And 2 seconds have passed
      When the room is available again
      Then White has 2 seconds left and Black has 4 seconds left

    Scenario: A start its maker did not hear back about still runs out of time
      Given White and Black started a match as the room became unavailable
      And 4 seconds have passed
      When the room is available again
      Then White and Black both see Black win on time

    Scenario: An interrupted move cannot leave the next player's clock stopped
      Given White and Black have started a match with 4 seconds for White and 4 seconds for Black
      And White has moved as the room became unavailable
      And 4 seconds have passed
      When the room is available again
      Then White and Black both see White win on time
