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

  Rule: Two bots play a Battleship game to a victory by themselves
    No counter-example: neither bot needs a person to place its fleet, become ready or shoot, and every shot a bot makes is one the rules allow.

    Scenario: Two bots play Battleship to a victory
      Given Alice has started a custom game of Battleship between two Easy bots
      When the bots play their turns
      Then one Battleship bot wins
