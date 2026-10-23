@domain:quoridor
Feature: Move and jump with Quoridor pawns
  When Alice moves her Quoridor pawn, she wants clear movement and jumping rules, so pawns never share a square or pass through a wall.

  Rule: A pawn moves one square horizontally or vertically around walls

    Scenario: A forward move passes the turn
      Given Alice has a new Classic Quoridor game
      When Alice moves her Quoridor pawn to e2
      Then South's Quoridor pawn is on e2
      And North has the Quoridor turn

    Scenario: A pawn can move backwards
      Given Alice has the Quoridor position with South on e3 and North on e8
      When Alice moves her Quoridor pawn to e2
      Then South's Quoridor pawn is on e2
      And North has the Quoridor turn

    Scenario: A pawn cannot move two empty squares
      Given Alice has a new Classic Quoridor game
      When Alice moves her Quoridor pawn to e3
      Then Alice is told the Quoridor pawn move is not allowed
      And the Quoridor board, remaining walls and turn are unchanged

    Scenario: A pawn cannot move diagonally without an adjacent pawn
      Given Alice has a new Classic Quoridor game
      When Alice moves her Quoridor pawn to f2
      Then Alice is told the Quoridor pawn move is not allowed
      And the Quoridor board, remaining walls and turn are unchanged

    Scenario: A wall prevents a step across it
      Given Alice has the Quoridor position with South on e2, North on e8 and a horizontal wall at d2
      When Alice moves her Quoridor pawn to e3
      Then Alice is told a Quoridor wall blocks that pawn move
      And the Quoridor board, remaining walls and turn are unchanged

  Rule: A pawn jumps one adjacent pawn when the square behind it is free

    Scenario: A clear jump passes the opposing pawn
      Given Alice has the Quoridor position with South on e4 and North on e5
      When Alice moves her Quoridor pawn to e6
      Then South's Quoridor pawn is on e6
      And North has the Quoridor turn

    Scenario: The adjacent pawn's square cannot be occupied
      Given Alice has the Quoridor position with South on e4 and North on e5
      When Alice moves her Quoridor pawn to e5
      Then Alice is told that Quoridor square is occupied
      And the Quoridor board, remaining walls and turn are unchanged

    Scenario: A clear straight jump does not permit a diagonal alternative
      Given Alice has the Quoridor position with South on e4 and North on e5
      When Alice moves her Quoridor pawn to d5
      Then Alice is told the Quoridor pawn move is not allowed
      And the Quoridor board, remaining walls and turn are unchanged

    Scenario: A wall between the pawns prevents jumping
      Given Alice has the Quoridor position with South on e4, North on e5 and a horizontal wall at d4
      When Alice moves her Quoridor pawn to e6
      Then Alice is told a Quoridor wall blocks that pawn move
      And the Quoridor board, remaining walls and turn are unchanged

  Rule: A blocked straight jump permits an empty square beside the adjacent pawn

    Scenario: A wall behind the adjacent pawn permits a diagonal move
      Given Alice has the Quoridor position with South on e4, North on e5 and a horizontal wall at d5
      When Alice moves her Quoridor pawn to d5
      Then South's Quoridor pawn is on d5
      And North has the Quoridor turn

    Scenario: The board edge behind the adjacent pawn permits a diagonal move
      Given Alice has the Quoridor position with South on d1 and North on e1
      When Alice moves her Quoridor pawn to e2
      Then South's Quoridor pawn is on e2
      And North has the Quoridor turn

    Scenario: A wall beside the adjacent pawn prevents that diagonal move
      Given Alice has the Quoridor position with South on e4, North on e5, a horizontal wall at d5 and a vertical wall at d4
      When Alice moves her Quoridor pawn to d5
      Then Alice is told a Quoridor wall blocks that pawn move
      And the Quoridor board, remaining walls and turn are unchanged

    Scenario: A third pawn behind the adjacent pawn permits a diagonal move
      Given Alice has the hill mode Quoridor position with South on d3, West on d4, North on d5 and East on i5
      When Alice moves her Quoridor pawn to c4
      Then South's Quoridor pawn is on c4
      And West has the Quoridor turn

    Scenario: A jump cannot pass two adjacent pawns
      Given Alice has the hill mode Quoridor position with South on d3, West on d4, North on d5 and East on i5
      When Alice moves her Quoridor pawn to d6
      Then Alice is told a Quoridor jump cannot pass more than one pawn
      And the Quoridor board, remaining walls and turn are unchanged

  Rule: Every player moves their own pawn in the declared turn order

    Scenario: The fourth player's move returns the turn to South
      Given Alice, Bob, Carol and Dave have a King of the Hill game after each of the first three players has moved
      When Dave moves his Quoridor pawn to h5
      Then East's Quoridor pawn is on h5
      And South has the Quoridor turn

    Scenario: The next player cannot move before South
      Given Alice and Bob have a new Classic Quoridor game
      When Bob moves his Quoridor pawn to e8
      Then Bob is told it is South's Quoridor turn
      And the Quoridor board, remaining walls and turn are unchanged
