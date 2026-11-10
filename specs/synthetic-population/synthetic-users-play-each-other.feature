@domain:synthetic-population
Feature: Synthetic Users play each other
  When no person is looking for a multiplayer opponent, people want
  Synthetic Users to play each other as people do, so the app is always full
  of games being played.

  Rule: With no person looking for the same game, Synthetic Users looking for it become each other's multiplayer opponents
    No counter-example: a person looking is matched with an available Synthetic User within 30 seconds, so Synthetic Users are only ever left looking when no person is.

    Scenario: Two Synthetic Users become each other's multiplayer opponents
      Given the Synthetic User "Cedar" is looking for a multiplayer opponent for "Connect Four"
      And nobody else is looking for a multiplayer opponent for "Connect Four"
      And the Synthetic User "Maple" is ready to play "Connect Four"
      When "Maple" starts its next activity
      Then "Maple"'s multiplayer opponent is "Cedar" within 30 seconds

  Rule: Synthetic Users playing each other reach a multiplayer result

    Scenario Outline: Two Synthetic Users finish their <game> game
      Given the Synthetic Users "Cedar" and "Maple" have an ongoing "<game>" game against each other
      When "Cedar" continues its current activity
      Then "Cedar" has a multiplayer result
      And "Maple" has a multiplayer result

      Examples:
        | game |
        | chess |
        | Connect Four |
        | Battleship |
        | Pong |

    Scenario: An offline Synthetic User keeps its game against another Synthetic User
      Given the Synthetic Users "Cedar" and "Maple" have an ongoing "Connect Four" game against each other
      And Cedar is offline
      When "Cedar" continues its current activity
      Then Cedar is told the connection is missing within 5 seconds
      And the Synthetic User "Cedar" continues its same multiplayer game
