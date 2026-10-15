@domain:room
Feature: Timed matches keep their clocks after interruption
  When a timed match cannot continue for either player, its players want the same match and time kept, so the interruption cannot decide who won.

  Rule: A match unavailable to both players keeps the time left
    No counter-example: no player can spend time while the match itself cannot be played.

    Scenario: Returning keeps all time left when the match became unavailable
      Given White and Black started a match as the room became unavailable
      And 2 seconds have passed
      When the room is available again
      Then White has 4 seconds left and Black has 4 seconds left

    Scenario: An accepted start remains the same match after a long interruption
      Given White and Black started a match as the room became unavailable
      And 4 seconds have passed
      When the room is available again
      Then the match is still playing with White to move
      And White has 4 seconds left and Black has 4 seconds left

    Scenario: A move accepted before interruption keeps the next player to move
      Given White and Black have started a match with 4 seconds for White and 4 seconds for Black
      And White has moved as the room became unavailable
      And 4 seconds have passed
      When the room is available again
      Then Black is to move
      And White has 4 seconds left and Black has 4 seconds left

  Rule: One player's missing connection does not pause an available match

    Scenario: A returning player sees time ran out while their phone was offline
      Given White and Black have started a match with 4 seconds for White and 4 seconds for Black
      And White's phone has been offline for 4 seconds
      When White's phone comes back online
      Then White and Black both see Black win on time

    Scenario: A disconnected player still has time before the deadline
      Given White and Black have started a match with 4 seconds for White and 4 seconds for Black
      And White's phone is offline
      When 2 seconds pass
      Then the match is still playing with White to move
      And White has 2 seconds left and Black has 4 seconds left
