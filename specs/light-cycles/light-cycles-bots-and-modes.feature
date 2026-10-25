@domain:light-cycles
Feature: Ride against bots or find players for a mode
  When Alice wants a game of Light Cycles, she wants bots or other people to ride against in the mode she picks, so she can play with or without anyone else and with or without a connection.

  Rule: Any rider can be a bot, always shown as a bot with its level, and the bots are chosen before the game starts

    Background:
      Given Alice has created a Light Cycles Trio custom game

    Scenario Outline: A bot of each level rides Nova
      When Alice chooses a <level> bot to ride Nova
      Then everyone in the space sees Nova shown as a <level> bot

      Examples:
        | level  |
        | easy   |
        | medium |
        | hard   |

    Scenario Outline: The bots cannot change once the game has started
      Given the Light Cycles game is <stage>
      When Alice chooses a hard bot to ride Nova
      Then Alice is told the bots cannot change once the game has started

      Examples:
        | stage      |
        | under way  |
        | finished   |
        | called off |

    Scenario: Only the creator chooses the bots
      Given Bob rides Ember in Alice's custom game
      When Bob chooses a hard bot to ride Nova
      Then Bob is told only the creator chooses the bots

    Scenario: Nobody steers a rider a bot rides
      Given Alice has started the custom game with Alice riding Comet and a hard bot riding Nova
      When Alice steers Nova up
      Then Alice cannot steer Nova because a bot rides it

  Rule: A bot steers its rider, and the rider crashes, by the same rules as a person's rider

    Background:
      Given Alice's Light Cycles Trio practice has a medium bot riding Ember at column 20, row 10 heading left

    Scenario: A bot never turns its rider straight back
      When the bot steers Ember
      Then Ember's next step is up, down or left

    Scenario: A boxed-in bot rider crashes like any rider
      Given trails cover column 19, row 10, column 20, row 9 and column 20, row 11
      When the riders take their next step
      Then Ember has crashed and is still at column 20, row 10

  Rule: Practice against bots needs no connection and stays on its own device

    Scenario: Practice begins without a connection
      Given Alice is offline
      When Alice starts Light Cycles Duel practice against a medium bot
      Then the first round counts down with Alice riding Comet and the bot riding Ember

    Scenario: Practice keeps Alice riding without a connection
      Given Alice is offline
      And Alice's Light Cycles Duel practice is riding with Comet at column 5, row 14 heading right
      When 3 seconds pass
      Then Comet is at column 35, row 14 heading right
      And Alice can steer Comet

    Scenario: Practice reaches a victory without a connection
      Given Alice is offline
      And Alice's Light Cycles Duel practice has Comet on 2 round wins against a hard bot with a target score of 3
      When Ember crashes
      Then Alice sees Comet, ridden by Alice, won the Light Cycles game

    Scenario Outline: Starting practice again changes nothing
      Given Alice's Light Cycles Duel practice is <stage>
      When Alice starts Light Cycles Duel practice against a medium bot
      Then Alice's Light Cycles Duel practice is still <stage>

      Examples:
        | stage     |
        | under way |
        | finished  |

    Scenario: Practice cannot move to another device
      Given Alice is also signed in on another device
      And Alice's Light Cycles Duel practice is under way
      When Alice switches devices
      Then Alice cannot steer Comet from her other device because her practice stays on her first device
      And Alice can steer Comet

  Rule: Each mode is its own game, with its own custom games and its own finding players

    Scenario: Each mode can be picked as a space's game
      Given Bob has joined Alice's space
      When Alice picks Light Cycles Trio as the space's game
      Then Alice and Bob are offered Light Cycles Trio's custom games and finding players

    Scenario: People finding players for the same mode ride together
      Given Alice, Bob and Carol are finding players for Light Cycles Trio
      When people are paired up
      Then Alice, Bob and Carol each ride a different one of Comet, Ember and Nova
      And the Light Cycles game has a target score of 3

    Scenario: People finding players for different modes are not paired up together
      Given Alice and Bob are finding players for Light Cycles Trio
      And Carol is finding players for Light Cycles Duel
      When people are paired up
      Then Alice, Bob and Carol are still finding players
