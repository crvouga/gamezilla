@domain:battleship
Feature: What each Battleship player sees
  When Alice plays Battleship, she wants to see her own fleet and only what her shots have shown of Bob's, so neither player learns where the other's ships are except by shooting.

  Background:
    Given Alice and Bob have started Battleship with Bob's destroyer on C3 and C4

  Rule: A player sees their whole fleet and every shot the other player made at it
    No counter-example: a player's own fleet is never hidden from them.

    Scenario: A player's own board shows their ships and the other player's shot
      Given Alice has missed H8
      When Bob shoots at A1
      Then Alice's own board shows Bob's shot at A1
      And Alice's own board shows all five of her ships

  Rule: The other player's fleet stays hidden except what each shot shows

    Scenario: A miss shows only that its cell is empty
      When Alice shoots at H8
      Then Alice's targeting board shows only a miss at H8

    Scenario: A hit shows only that its cell holds a ship
      When Alice shoots at C3
      Then Alice's targeting board shows only a hit at C3, naming no ship

    Scenario: A sinking names the ship and shows nothing more
      Given Alice has hit C3 and Bob has shot in reply
      When Alice shoots at C4
      Then Alice's targeting board shows only Bob's sunk destroyer on C3 and C4

    Scenario: A refused shot shows nothing of the other player's fleet
      Given Alice has hit C3
      When Alice shoots at C4
      Then Alice is told it is the other player's turn
      And Alice's targeting board still shows only a hit at C3, naming no ship
