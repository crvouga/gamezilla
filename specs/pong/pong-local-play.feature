@domain:pong
Feature: Play Pong on one device without a connection
  When Alice plays Pong on one device, she wants to keep playing with Bob or
  a bot without a connection, so other people's availability cannot stop her game.

  Rule: Starting local Pong needs no connection
    No counter-example: both people share the device, and a bot needs nobody else.

    Scenario Outline: Local Pong starts offline with the chosen opponent
      Given Alice has local Pong ready to start against <opponent>
      And Alice is offline
      When Alice starts local Pong
      Then Alice's local Pong is under way
      And Alice can guide <paddles> in Pong

      Examples:
        | opponent   | paddles              |
        | Bob        | both paddles         |
        | a Pong bot | only the left paddle |

  Rule: Connection changes keep local Pong available as it was
    No counter-example: local play belongs to the device, whether or not it can reach anyone else.

    Scenario Outline: Losing the connection keeps local Pong available
      Given Alice has local Pong <stage> against Bob
      When Alice loses the connection
      Then Alice still has her local Pong game
      And Alice's local Pong is <stage>

      Examples:
        | stage          |
        | ready to start |
        | under way      |
        | finished       |

    Scenario Outline: Getting the connection back keeps local Pong available
      Given Alice has local Pong <stage> against Bob
      And Alice is offline
      When the connection comes back
      Then Alice still has her local Pong game
      And Alice's local Pong is <stage>

      Examples:
        | stage          |
        | ready to start |
        | under way      |
        | finished       |

  Rule: A local Pong bot can finish the game without a connection
    No counter-example: the bot plays on the same device as Alice.

    Scenario: Pong against a bot reaches a victory offline
      Given Alice has local Pong under way against a Pong bot
      And Alice is offline
      When local Pong finishes
      Then Alice's local Pong is finished
      And Alice cannot guide either paddle because Pong has finished

  Rule: Reopening local Pong keeps it ready to start as well as keeping games already started
    No counter-example: opening the app again never starts or replaces local Pong.

    Scenario: Reopening a local game before start keeps it ready
      Given Alice has local Pong ready to start against Bob
      When Alice closes and reopens the app
      Then Alice still has her local Pong game
      And Alice's local Pong is ready to start
