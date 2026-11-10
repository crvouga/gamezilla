@domain:synthetic-population
Feature: Finding a multiplayer opponent quickly
  When a person looks for a multiplayer opponent, they want to be playing
  within moments against many different players, so the app always feels
  full of people to play.

  Rule: When nobody else is looking for the same game, an available Synthetic User becomes the person's multiplayer opponent within 30 seconds
    No counter-example: with no Synthetic User available the person keeps looking, which the next rule shows.

    Scenario Outline: A person finds a Synthetic User as a <game> multiplayer opponent within 30 seconds
      Given the Synthetic User "Cedar" is available
      And nobody else is looking for a multiplayer opponent for "<game>"
      When Bob looks for a multiplayer opponent for "<game>"
      Then Bob's multiplayer opponent is "Cedar" within 30 seconds
      And Bob sees "Cedar" identified as a Synthetic User

      Examples:
        | game |
        | chess |
        | Connect Four |
        | Battleship |
        | Pong |

  Rule: With no Synthetic User available, a person keeps looking and is told so
    No counter-example: an available Synthetic User is the first rule's example.

    Scenario: A person keeps looking when the desired synthetic population is 0
      Given the desired synthetic population is 0
      And nobody else is looking for a multiplayer opponent for "chess"
      When Bob looks for a multiplayer opponent for "chess"
      Then Bob is still looking for a multiplayer opponent for "chess" 30 seconds later
      And Bob is told he is still looking for a multiplayer opponent

    Scenario: A person keeps looking while every Synthetic User is paused
      Given every Synthetic User is paused
      And nobody else is looking for a multiplayer opponent for "chess"
      When Bob looks for a multiplayer opponent for "chess"
      Then Bob is still looking for a multiplayer opponent for "chess" 30 seconds later
      And Bob is told he is still looking for a multiplayer opponent

  Rule: A person who plays several games in a row meets different Synthetic Users when more than one is available
    No counter-example: with a single Synthetic User available, meeting it again is how the person still finds a multiplayer opponent quickly, as the second scenario shows.

    Scenario: A person's next multiplayer opponent is a different Synthetic User
      Given the Synthetic Users "Cedar" and "Maple" are available
      And Bob's latest multiplayer opponent for "chess" was "Cedar"
      When Bob looks for a multiplayer opponent for "chess"
      Then Bob's multiplayer opponent is "Maple" within 30 seconds

    Scenario: A person meets the same Synthetic User again when it is the only one available
      Given "Cedar" is the only Synthetic User available
      And Bob's latest multiplayer opponent for "chess" was "Cedar"
      When Bob looks for a multiplayer opponent for "chess"
      Then Bob's multiplayer opponent is "Cedar" within 30 seconds
