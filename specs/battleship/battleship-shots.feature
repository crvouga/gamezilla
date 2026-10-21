@domain:battleship
Feature: Take turns shooting in Battleship
  When Alice and Bob play Battleship, they want one shot each in turn at cells not yet shot at, so every hit and miss is fair and both see the same hits and misses.

  Background:
    Given Alice and Bob have started Battleship with Bob's destroyer on C3 and C4

  Rule: A shot at a cell with a ship is a hit, and at any other cell a miss
    No counter-example: every shot the rules allow is exactly one of the two.

    Scenario: A shot at a ship's cell is a hit for both players
      When Alice shoots at C3
      Then Alice and Bob see the shot at C3 is a hit

    Scenario: A shot at a cell without a ship is a miss for both players
      When Alice shoots at H8
      Then Alice and Bob see the shot at H8 is a miss

  Rule: Each turn is one shot, and the turn passes after every hit and every miss

    Scenario: A hit passes the turn to the other player
      When Alice shoots at C3
      Then Bob has the Battleship turn

    Scenario: A miss passes the turn to the other player
      When Alice shoots at H8
      Then Bob has the Battleship turn

    Scenario: A hit gives no extra shot
      Given Alice has hit C3
      When Alice shoots at C4
      Then Alice is told it is the other player's turn
      And the Battleship boards and turn are unchanged

  Rule: Only the player whose turn it is may shoot

    Scenario: The second player shoots after the first player's shot
      Given Alice has missed H8
      When Bob shoots at A1
      Then Alice has the Battleship turn

    Scenario: A shot out of turn is refused
      When Bob shoots at A1
      Then Bob is told it is the other player's turn
      And the Battleship boards and turn are unchanged

  Rule: A cell already shot at cannot be shot again

    Scenario: Another untargeted cell can still be shot
      Given Alice has missed H8 and Bob has shot in reply
      When Alice shoots at H9
      Then Alice and Bob see the shot at H9 is a miss

    Scenario: A second shot at the same cell is refused
      Given Alice has hit C3 and Bob has shot in reply
      When Alice shoots at C3
      Then Alice is told she has already shot at C3
      And the Battleship boards and turn are unchanged

  Rule: Shooting needs a connection, and a returning player sees the shots made meanwhile

    Scenario: A player without a connection cannot shoot
      Given Alice is offline
      When Alice shoots at C3
      Then Alice is told the game needs a connection
      And the Battleship boards and turn are unchanged

    Scenario: A player without a connection keeps their last boards
      Given Alice has missed H8
      And Alice's phone is offline
      When Bob shoots at A1
      Then Alice's own board does not show Bob's shot at A1

    Scenario: A returning player's own board shows the shot made while they were offline
      Given Alice has missed H8
      And Alice's phone was offline when Bob shot at A1
      When the connection comes back
      Then Alice's own board shows Bob's shot at A1
