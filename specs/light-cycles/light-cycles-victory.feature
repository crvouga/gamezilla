@domain:light-cycles
Feature: Win or draw a Light Cycles game
  When riders collect round wins, everyone wants one clear end to the game named by rider and person, so the game is decided once and stays decided.

  Rule: The first rider to reach the target score wins the Light Cycles game

    Background:
      Given Alice rides Comet and Bob rides Ember in a Light Cycles Duel with a target score of 3

    Scenario: A third round win wins a game to 3
      Given Comet has 2 round wins and Ember has 1
      When Ember crashes
      Then everyone sees Comet, ridden by Alice, won the Light Cycles game
      And the final score is 3 to 1

    Scenario: A round win short of the target score keeps the game unfinished
      Given Comet has 1 round win and Ember has 1
      When Ember crashes
      Then Comet has 2 round wins and Ember has 1
      And the Light Cycles game is still unfinished

  Rule: The custom game's creator may choose a target score from 1 to 9 before it starts, and it is 3 otherwise

    Background:
      Given Alice has created a Light Cycles Duel custom game with Bob riding Ember

    Scenario: A new custom game is played to 3 round wins
      When Alice starts the custom game
      Then the Light Cycles game has a target score of 3

    Scenario Outline: The creator chooses a target score from 1 to 9
      When Alice chooses a target score of <target>
      Then the Light Cycles game has a target score of <target>

      Examples:
        | target |
        | 1      |
        | 9      |

    Scenario Outline: A target score outside 1 to 9 is refused
      When Alice chooses a target score of <target>
      Then Alice is told the target score must be from 1 to 9
      And the Light Cycles game still has a target score of 3

      Examples:
        | target |
        | 0      |
        | 10     |

    Scenario: Only the creator chooses the target score
      When Bob chooses a target score of 5
      Then Bob is told only the creator chooses the target score
      And the Light Cycles game still has a target score of 3

    Scenario Outline: The target score cannot change once the game has started
      Given the Light Cycles game is <stage>
      When Alice chooses a target score of 5
      Then Alice is told the target score cannot change once the game has started
      And the Light Cycles game still has a target score of 3

      Examples:
        | stage      |
        | under way  |
        | finished   |
        | called off |

  Rule: After the 15th round, the rider with the most round wins wins the game, and equal leaders draw it

    Background:
      Given Alice rides Comet and Bob rides Ember in a Light Cycles Duel with a target score of 9

    Scenario: A drawn 15th round gives the leader the game
      Given Comet has 7 round wins and Ember has 6 after 14 rounds
      When Comet and Ember both crash
      Then everyone sees Comet, ridden by Alice, won the Light Cycles game
      And the final score is 7 to 6

    Scenario: Equal leaders after the 15th round draw the game
      Given Comet has 7 round wins and Ember has 6 after 14 rounds
      When Comet crashes
      Then everyone sees the Light Cycles game was drawn
      And the final score is 7 to 7

    Scenario: The 14th round without a winner of the game leads to a 15th
      Given Comet has 7 round wins and Ember has 5 after 13 rounds
      When Ember crashes
      Then Comet has 8 round wins and Ember has 5
      And the Light Cycles game is still unfinished

  Rule: A finished Light Cycles game never changes
    No counter-example: nothing reopens a finished game.

    Scenario: Time passing keeps a finished game's score and stops all steering
      Given Alice rides Comet and Bob rides Ember in a Light Cycles Duel
      And Comet has won the Light Cycles game by 3 to 1
      When 5 seconds pass
      Then the final score is still 3 to 1
      And Alice cannot steer Comet because the Light Cycles game is finished
