@domain:battleship
Feature: Place a Battleship fleet
  When Alice prepares for Battleship, she wants to place her five ships where she likes within the classic rules, so her fleet is complete and fair before the first shot.

  Background:
    Given Alice is placing her Battleship fleet

  Rule: A ship lies horizontally or vertically, entirely inside the board

    Scenario: A carrier placed horizontally from F1 reaches the last column
      When Alice places her carrier horizontally from F1
      Then Alice's carrier covers F1, G1, H1, I1 and J1

    Scenario: A battleship placed vertically from J7 reaches the last row
      When Alice places her battleship vertically from J7
      Then Alice's battleship covers J7, J8, J9 and J10

    Scenario Outline: A ship that would run off the board is refused
      When Alice places her carrier <direction> from <cell>
      Then Alice is told the ship must fit inside the board
      And Alice's carrier is not placed

      Examples:
        | direction    | cell |
        | horizontally | G1   |
        | vertically   | A7   |

  Rule: Rotating turns a placed ship between horizontal and vertical from its first cell

    Scenario: A horizontal cruiser turns vertical
      Given Alice has placed her cruiser horizontally from B2
      When Alice rotates her cruiser
      Then Alice's cruiser covers B2, B3 and B4

    Scenario: A rotation that would run off the board is refused
      Given Alice has placed her carrier horizontally from A8
      When Alice rotates her carrier
      Then Alice is told the ship must fit inside the board
      And Alice's carrier still covers A8, B8, C8, D8 and E8

  Rule: Ships never share a cell, but may touch side by side or corner to corner

    Background:
      Given Alice has placed her carrier horizontally from A1

    Scenario: A ship placed onto another ship is refused
      When Alice places her destroyer vertically from C1
      Then Alice is told ships cannot share a cell
      And Alice's destroyer is not placed

    Scenario: A ship may lie right beside another
      When Alice places her destroyer horizontally from A2
      Then Alice's destroyer covers A2 and B2

    Scenario: A ship may touch another at a corner
      When Alice places her destroyer vertically from F2
      Then Alice's destroyer covers F2 and F3

  Rule: Placing a ship again changes where it lies, until its player is ready

    Scenario: A ship placed again lies where it was placed last
      Given Alice has placed her destroyer horizontally from A1
      When Alice places her destroyer vertically from H5
      Then Alice's destroyer covers H5 and H6

    Scenario: A ready player's ships cannot be placed again
      Given Alice is ready for the custom game with a random fleet
      When Alice places her destroyer vertically from H5
      Then Alice is told her fleet cannot change while she is ready
      And Alice's own board keeps every ship in its place

    Scenario: A ready player's ships cannot be rotated
      Given Alice is ready for the custom game with a random fleet
      When Alice rotates her destroyer
      Then Alice is told her fleet cannot change while she is ready
      And Alice's own board keeps every ship in its place

    Scenario: A ready player cannot ask for a random fleet
      Given Alice is ready for the custom game with a random fleet
      When Alice asks for a random fleet
      Then Alice is told her fleet cannot change while she is ready
      And Alice's own board keeps every ship in its place

  Rule: A random fleet is complete and keeps every placing rule
    No counter-example: a random fleet never breaks a placing rule, and which cells it uses is not promised.

    Scenario: A random fleet replaces the ships already placed with a complete fleet
      Given Alice has placed her destroyer horizontally from A1
      When Alice asks for a random fleet
      Then Alice has a complete fleet
      And each of Alice's ships lies inside the board without sharing a cell

  Rule: Only a complete fleet can become ready, and becoming ready needs a connection

    Scenario: A complete fleet becomes ready
      Given Alice has a random fleet
      When Alice becomes ready for the custom game
      Then Alice is ready for the custom game

    Scenario: A fleet with a ship missing cannot become ready
      Given Alice has placed four of her five ships
      When Alice becomes ready for the custom game
      Then Alice is told her fleet is incomplete
      And Alice is not ready for the custom game

    Scenario: A player without a connection cannot become ready
      Given Alice has a random fleet
      And Alice is offline
      When Alice becomes ready for the custom game
      Then Alice is told the game needs a connection
