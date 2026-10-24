@domain:pong
Feature: Watch Pong played on one device
  When Alice plays Pong on her device, Carol wants to see the game from Alice's
  space, so she can follow play without taking either paddle.

  Rule: A person in the space can see local Pong without controlling it

    Scenario Outline: Carol joins while Alice is already playing
      Given Alice has local Pong under way against <opponent>
      And Alice's Pong paddle is at the upper edge
      When Carol joins Alice's space
      Then Carol sees Pong's left paddle at the upper edge
      And Carol cannot guide either paddle because neither belongs to her

      Examples:
        | opponent   |
        | Bob        |
        | a Pong bot |

    Scenario Outline: Carol cannot take over a paddle in local play
      Given Alice has local Pong under way against a Pong bot
      And Carol is in Alice's space with no Pong paddle
      When Carol tries to guide Pong's <paddle> paddle to the lower edge
      Then Carol cannot guide either paddle because neither belongs to her
      And Carol sees Pong's <paddle> paddle at the middle

      Examples:
        | paddle |
        | left   |
        | right  |

  Rule: A missing connection keeps the viewer's earlier court while local play continues
    No counter-example: local play needs no connection, but Carol can see a changed court only while both devices have a connection.

    Scenario Outline: Carol keeps the earlier court while Alice keeps playing
      Given Alice has local Pong under way against a Pong bot
      And Carol is in Alice's space with no Pong paddle
      And <person> is offline
      When Alice guides Pong's left paddle to the upper edge
      Then Carol sees Pong's left paddle at the middle
      And Alice sees Pong's left paddle at the upper edge

      Examples:
        | person |
        | Alice  |
        | Carol  |

  Rule: Returning shows the current local court without giving the viewer a paddle
    No counter-example: the viewer can follow the current game again once both connections are available.

    Scenario Outline: Carol sees Alice's local progress after the connection returns
      Given Alice has local Pong under way against a Pong bot
      And Carol is in Alice's space with no Pong paddle
      And <person> is offline
      And Alice's Pong paddle is at the upper edge
      When the connection comes back
      Then Carol sees Pong's left paddle at the upper edge
      And Carol cannot guide either paddle because neither belongs to her

      Examples:
        | person |
        | Alice  |
        | Carol  |
