@domain:battleship
Feature: Play Battleship with bots
  When Alice chooses a bot, she wants another player at her chosen difficulty that places its own fleet and shoots fairly, so she can play against it or let two bots play each other.

  Rule: A bot of every difficulty places a complete fleet and is ready by itself when the custom game starts
    No counter-example: a bot never waits for anyone to place its fleet.

    Scenario Outline: A bot is ready with a complete fleet when the custom game starts
      Given Alice is ready for a custom game of Battleship against the <difficulty> bot
      When Alice starts the custom game
      Then the Battleship bot is ready with a complete fleet
      And Alice has the Battleship turn

      Examples:
        | difficulty |
        | Easy       |
        | Medium     |
        | Hard       |

  Rule: A bot of every difficulty shoots only at an untargeted cell, on its turn
    No counter-example: a bot never makes a shot the rules refuse.

    Scenario Outline: A bot finds the last untargeted cell
      Given the <difficulty> Battleship bot is the first player and has shot at every cell of Alice's board but J10
      When the Battleship bot shoots
      Then the Battleship bot's shot is at J10

      Examples:
        | difficulty |
        | Easy       |
        | Medium     |
        | Hard       |

  Rule: A Hard bot follows up a hit on a ship still afloat
    No counter-example: with no hit ship afloat, a Hard bot still makes a shot the rules allow.

    Scenario: A Hard bot shoots next to its hit
      Given the Hard Battleship bot has the turn after hitting Alice's carrier on E5
      When the Battleship bot shoots
      Then the Battleship bot's shot is at D5, F5, E4 or E6

  Rule: Two bots play a Battleship game to a victory by themselves
    No counter-example: neither bot needs a person to place its fleet, become ready or shoot.

    Scenario: Two bots play Battleship to a victory
      Given Alice has started a custom game of Battleship between two Easy bots
      When the bots play their turns
      Then one Battleship bot wins
