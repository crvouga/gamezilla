@domain:rooms
Feature: Match clock
  White and Black each have a bank of time. The room's own clock runs down
  the bank of the side to move and ends the match the moment it runs out, so
  a slow, cut-off, or offline player can neither dodge their flag nor end the
  match early by claiming it.

  Rule: The side whose time runs out loses

    Scenario: The side whose time runs out loses
      Given White and Black have started a match with 50 ms for White and 80 ms for Black
      When 60 ms pass
      Then White and Black both see Black win on time

  Rule: A move keeps the mover's remaining time and passes the clock

    Scenario: A move before the flag passes the clock to the opponent
      Given White and Black have started a match with 100 ms for White and 100 ms for Black
      When 30 ms pass
      And White moves
      Then the match is still playing with Black to move
      And White has 70 ms left and Black has 100 ms left

  Rule: The mover's time does not run on the opponent's turn

    Scenario: The mover's time does not run on the opponent's turn
      Given White and Black have started a match with 100 ms for White and 100 ms for Black
      And White has moved after 30 ms
      When 40 ms pass
      Then the match is still playing with Black to move
      And White still has 70 ms left

  Rule: The opponent loses on their own time

    Scenario: The opponent loses when their own time runs out
      Given White and Black have started a match with 100 ms for White and 100 ms for Black
      And White has moved after 30 ms
      When 110 ms pass
      Then White and Black both see White win on time

  Rule: A player whose network stalls cannot move after their flag fell

    Scenario: A cut-off player cannot move after their flag fell
      Given White and Black have started a match with 40 ms for White and 40 ms for Black
      And White's network has stalled
      When 50 ms pass
      And White moves
      And White's network recovers
      Then White and Black both see Black win on time

  Rule: Claiming one's own flag early does not end the match

    Scenario: Claiming one's own flag early does not end the match
      Given White and Black have started a match with 80 ms for White and 80 ms for Black
      When White claims White's flag has fallen
      Then the match is still playing with White to move

  Rule: The room flags on time whatever anyone claims

    Scenario: The room still flags on time after an early claim
      Given White and Black have started a match with 80 ms for White and 80 ms for Black
      And White has claimed White's flag has fallen
      When 90 ms pass
      Then White and Black both see Black win on time

  Rule: A player who was offline when their flag fell sees the result

    Scenario: A player who reconnects after their flag fell sees the result
      Given White and Black have started a match with 40 ms for White and 40 ms for Black
      And White's device is offline
      When 50 ms pass
      And White reconnects
      Then White and Black both see Black win on time
