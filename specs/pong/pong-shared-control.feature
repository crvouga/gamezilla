@domain:pong
Feature: Guide Pong from separate devices
  When Alice plays Pong with Bob on separate devices, she wants her paddle to respond and the court to agree for both, so they can keep returning the ball together.

  Background:
    Given Alice and Bob were paired up for Pong with Alice at the left paddle

  Rule: Each person guides their own paddle within the court

    Scenario Outline: Alice guides her paddle between the middle and both edges
      Given Alice's Pong paddle is at the <before>
      When Alice guides Pong's left paddle to the <after>
      Then Alice and Bob see Pong's left paddle at the <after>
      And Bob can guide only the right paddle in Pong

      Examples:
        | before     | after      |
        | middle     | upper edge |
        | upper edge | middle     |
        | middle     | lower edge |
        | lower edge | middle     |
        | upper edge | lower edge |
        | lower edge | upper edge |

    Scenario: Bob cannot take over Alice's paddle
      When Bob tries to guide Pong's left paddle to the upper edge
      Then Bob cannot guide the left paddle because it belongs to Alice
      And Alice and Bob see Pong's left paddle at the middle

    Scenario: Bob guides his own paddle independently
      When Bob guides Pong's right paddle to the lower edge
      Then Alice and Bob see Pong's right paddle at the lower edge
      And Alice and Bob see Pong's left paddle at the middle

  Rule: A person in the space with no paddle can see play without controlling it

    Scenario: Carol arriving later sees where Alice's paddle has reached
      Given Alice's Pong paddle is at the upper edge
      When Carol joins Alice's space
      Then Carol sees Pong's left paddle at the upper edge
      And Carol cannot guide either paddle because neither belongs to her

    Scenario: Carol cannot take over either person's paddle
      Given Carol is in Alice's space with no Pong paddle
      When Carol tries to guide Pong's right paddle to the lower edge
      Then Carol cannot guide either paddle because neither belongs to her
      And Carol sees Pong's right paddle at the middle

  Rule: Losing a player's connection suspends paddle guidance until that person returns

    Scenario Outline: Each player waits for the missing connection before guiding a paddle
      When <missing> loses the connection
      Then <other> cannot guide their paddle while <missing> has no connection
      And <missing> cannot guide their paddle while <missing> has no connection

      Examples:
        | missing | other |
        | Alice   | Bob   |
        | Bob     | Alice |

    Scenario Outline: Returning restores the person's own paddle and the agreed court
      Given <person>'s Pong paddle is at the upper edge
      And <person> is offline
      When the connection comes back
      Then Alice and Bob see Pong's <paddle> paddle at the upper edge
      And <person> can guide only the <paddle> paddle in Pong

      Examples:
        | person | paddle |
        | Alice  | left   |
        | Bob    | right  |

  Rule: Losing the connection of a person with no paddle does not stop the players
    No counter-example: Carol has no paddle, so her connection cannot decide whether Alice and Bob can guide theirs.

    Scenario: Carol going offline keeps both players able to guide their paddles
      Given Carol is in Alice's space with no Pong paddle
      When Carol loses the connection
      Then Alice can guide only the left paddle in Pong
      And Bob can guide only the right paddle in Pong

  Rule: An offline person keeps the court last shown on that device
    No counter-example: a person without a connection keeps the court they last saw until the connection returns.

    Scenario: Carol keeps the earlier court while the players keep playing
      Given Carol is in Alice's space with no Pong paddle
      And Carol is offline
      When Alice guides Pong's left paddle to the upper edge
      Then Carol sees Pong's left paddle at the middle
      And Alice and Bob see Pong's left paddle at the upper edge
