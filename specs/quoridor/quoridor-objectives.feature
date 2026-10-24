@domain:quoridor
Feature: Reach the Quoridor goal first
  When Alice races to the Quoridor goal, she wants the result decided at once, so nobody can continue after the winning move.

  Rule: Classic is won on any square of the opposite home row

    Scenario: Reaching the opposite row wins Classic
      Given Alice has the Quoridor position with South on d8 and North on e7
      When Alice moves her Quoridor pawn to d9
      Then South wins Classic Quoridor immediately

    Scenario: Reaching the center does not win Classic
      Given Alice has the Quoridor position with South on e4 and North on e8
      When Alice moves her Quoridor pawn to e5
      Then the Quoridor game continues with North's turn

  Rule: The first arrival on the single hill square wins immediately without a hold

    Scenario: Arriving at the center wins before another player takes a turn
      Given Alice has the hill mode Quoridor position with South on e4, West on a5, North on e9 and East on i5
      When Alice moves her Quoridor pawn to e5
      Then South wins Four-Player King of the Hill immediately
      And no other Quoridor player takes a turn

    Scenario: The opposite home row does not win King of the Hill
      Given Alice has the hill mode Quoridor position with South on d8, West on a5, North on e9 and East on i5
      When Alice moves her Quoridor pawn to d9
      Then the Quoridor game continues with West's turn

  Rule: A victory permits no further pawn move or wall placement

    Scenario: Play before the goal remains possible
      Given Alice has the hill mode Quoridor position with South on e3, West on a5, North on e9 and East on i5
      When Alice moves her Quoridor pawn to e4
      Then the Quoridor game continues with West's turn

    Scenario: A pawn cannot move after the hill is won
      Given Alice has a Four-Player King of the Hill game South has won
      When Alice moves her Quoridor pawn to e6
      Then Alice is told the Quoridor game is finished
      And the Quoridor board, remaining walls and turn are unchanged

    Scenario: A wall cannot be placed after a Classic victory
      Given Alice has a Classic Quoridor game South has won
      When Alice places a horizontal Quoridor wall at d4
      Then Alice is told the Quoridor game is finished
      And the Quoridor board, remaining walls and turn are unchanged
