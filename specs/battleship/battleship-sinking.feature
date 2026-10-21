@domain:battleship
Feature: Sink ships and win Battleship
  When Alice hits Bob's ships, she wants each ship to sink on its last cell and the fifth sinking to win, so the game is over exactly when Bob's fleet is gone.

  Background:
    Given Alice and Bob have started Battleship

  Rule: A ship sinks on the hit to its last cell, and the sinking names the ship

    Scenario Outline: Each ship sinks on the hit to its last cell
      Given Alice has hit all but the last cell of Bob's <ship>
      When Alice shoots at the last cell of Bob's <ship>
      Then Alice and Bob see Bob's <ship> is sunk

      Examples:
        | ship       |
        | carrier    |
        | battleship |
        | cruiser    |
        | submarine  |
        | destroyer  |

    Scenario: A ship with a cell not yet hit stays afloat
      Given Alice has hit one cell of Bob's cruiser
      When Alice shoots at a second cell of Bob's cruiser
      Then Alice and Bob see a hit with no ship sunk
      And Bob's cruiser is still afloat

  Rule: Sinking the fifth ship wins at once, and the game then takes no more shots

    Scenario: Sinking the fifth ship wins
      Given Alice has sunk 4 of Bob's ships and hit one cell of his destroyer
      When Alice shoots at the last cell of Bob's destroyer
      Then Alice wins Battleship
      And Alice and Bob see the game is over

    Scenario: Sinking a fourth ship does not win
      Given Alice has sunk 3 of Bob's ships and hit one cell of his destroyer
      When Alice shoots at the last cell of Bob's destroyer
      Then Alice and Bob see Bob's destroyer is sunk
      And Battleship still has no winner

    Scenario: A shot after the victory is refused
      Given Alice has won Battleship against Bob
      When Bob shoots at A1
      Then Bob is told the game is over
      And the Battleship boards and turn are unchanged
