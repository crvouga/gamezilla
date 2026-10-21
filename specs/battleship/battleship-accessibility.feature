@domain:battleship
Feature: Accessible Battleship play
  When Alice plays Battleship on her device, she wants to place ships, shoot and follow both boards with the keyboard alone or by listening, so she can play without relying on colour or movement.

  Rule: The keyboard alone can place every ship within the placing rules

    Background:
      Given Alice is placing her Battleship fleet with the keyboard alone

    Scenario: A ship is placed with the keyboard
      When Alice places her destroyer horizontally from A1 with the keyboard
      Then Alice's destroyer covers A1 and B1

    Scenario: A ship that would run off the board is refused with the keyboard too
      When Alice places her carrier horizontally from G1 with the keyboard
      Then Alice is told the ship must fit inside the board
      And Alice's carrier is not placed

  Rule: The keyboard alone can shoot at any untargeted cell

    Background:
      Given Alice and Bob have started Battleship with Bob's destroyer on C3 and C4

    Scenario: A shot is made with the keyboard
      When Alice shoots at C3 with the keyboard
      Then Alice and Bob see the shot at C3 is a hit

    Scenario: A cell already shot at offers no shot
      Given Alice has hit C3 and Bob has shot in reply
      When Alice chooses C3 on her targeting board with the keyboard
      Then Alice cannot shoot at C3 again

  Rule: Both boards can be followed by listening to the app
    No counter-example: listening changes how the game is told, never what happens in it.

    Background:
      Given Alice and Bob have started Battleship with Bob's destroyer on C3 and C4
      And Alice is listening to the app

    Scenario: A player listening hears whether their shot hit and whose turn it is
      When Alice shoots at C3
      Then Alice hears her shot at C3 is a hit
      And Alice hears it is Bob's turn

    Scenario: A player listening hears a shot at their own board
      Given Alice has missed H8
      When Bob shoots at A1
      Then Alice hears Bob's shot at A1 on her own board

    Scenario: A player listening hears which ship sank
      Given Alice has hit C3 and Bob has shot in reply
      When Alice shoots at C4
      Then Alice hears she sank Bob's destroyer

  Rule: Hits, misses and sunk ships are told apart without colour or motion
    No counter-example: reduced motion changes how the game looks, never what happens in it.

    Scenario: Reduced motion keeps every mark distinct and shooting available
      Given Alice and Bob have started Battleship with Bob's destroyer on C3 and C4
      And Alice prefers reduced motion
      And Alice has missed H8 and hit C3, and Bob has shot in reply to each
      When Alice shoots at C4 with the keyboard
      Then Alice's targeting board shows her miss, her hits and the sunk destroyer as different marks, not by colour alone
