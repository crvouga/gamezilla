@domain:games
Feature: The custom game clock
  When choosing a timed custom game, the participants want the clock choice they agreed, so only the side to move spends time and running out of time ends play.

  Rule: A timed custom game gives each side from one to one hundred eighty minutes and adds from zero to sixty seconds a move

    Scenario: The largest clock choice is available
      Given Alice is setting up a custom game with Bob on the second side
      When Alice chooses 180+60 for the custom game
      Then the custom game is played at 180+60

    Scenario Outline: A clock choice outside the range is refused
      Given Alice is setting up a custom game with Bob on the second side
      When Alice chooses <clock choice> for the custom game
      Then Alice is told that clock choice is not offered

      Examples:
        | clock choice |
        | 0+0          |
        | 181+0        |
        | 1+-1         |
        | 1+61         |

  Rule: Only the side to move spends time, and a move adds the clock choice's seconds

    Scenario: The first side's move stops the first side's clock
      Given Alice and Bob have a custom game under way played at 1+2
      And 5 seconds have passed
      When Alice makes her move
      Then the first side has 57 seconds and the second side has 60 seconds

    Scenario: A move out of turn adds no seconds
      Given Alice and Bob have a custom game under way played at 1+2
      And 5 seconds have passed
      When Bob makes a move
      Then Bob is told it is the other player's turn
      And the second side has 60 seconds

  Rule: Running out of time ends play, even when a move arrives at that moment

    Scenario: The first side runs out of time and the second side wins
      Given Alice and Bob have a custom game under way played at 1+0
      When 60 seconds pass
      Then Bob wins the custom game on time

    Scenario: A move at the deadline cannot save the first side
      Given Alice and Bob have a custom game under way played at 1+0
      And the first side has run out of time
      When Alice makes her move
      Then Alice is told the game is finished
      And Bob wins the custom game on time

  Rule: The creator may choose an untimed custom game only before it starts

    Scenario: A timed choice can become untimed
      Given Alice is setting up a custom game with Bob on the second side
      And Alice has chosen 5+2 for the custom game
      When Alice chooses an untimed custom game
      Then the custom game is unrated and untimed

    Scenario: The clock of a custom game under way cannot be changed
      Given Alice and Bob have a custom game under way
      When Alice chooses an untimed custom game
      Then Alice is told the custom game has already started
