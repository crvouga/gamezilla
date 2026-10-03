@domain:chess
Feature: The Custom Game clock
  When choosing a timed game, the participants want their agreed time and increment, so only the side to move spends time and running out ends play.

  Rule: A timed game uses whole minutes from one to one hundred eighty and an increment from zero to sixty seconds

    Scenario: The largest time choice is available
      Given Alice has a Custom Game between Alice as White and Bob as Black
      When Alice chooses 180 minutes with 60 seconds increment for the Custom Game
      Then The Custom Game has 180 minutes with 60 seconds increment

    Scenario Outline: A time choice outside the limits is refused
      Given Alice has a Custom Game between Alice as White and Bob as Black
      When Alice chooses <minutes> minutes with <increment> seconds increment for the Custom Game
      Then Alice is told the time choice is outside the Custom Game limits

      Examples:
        | minutes | increment |
        | 0       | 0         |
        | 181     | 0         |
        | 1       | -1        |
        | 1       | 61        |

  Rule: Only the side to move spends time and a legal move adds its increment

    Scenario: White's move stops White's clock
      Given Alice has an active Custom Game with 1 minute and 2 seconds increment
      And 5 seconds have passed in the Custom Game
      When Alice plays e2-e4 in the Custom Game
      Then White has 57 seconds and Black has 60 seconds in the Custom Game

    Scenario: An out of turn move earns no increment
      Given Alice has an active Custom Game with 1 minute and 2 seconds increment
      And 5 seconds have passed in the Custom Game
      When Bob plays e7-e5 in the Custom Game
      Then Bob is told only the participant to move may play
      And Black has 60 seconds in the Custom Game

  Rule: Running out of time ends play even if a move arrives at that moment

    Scenario: White runs out and Black wins
      Given Alice has an active Custom Game with 1 minute and 0 seconds increment
      When 60 seconds pass
      Then Bob wins the Custom Game on time

    Scenario: A move at the deadline cannot save White
      Given Alice has an active Custom Game with 1 minute and 0 seconds increment
      And White's time has run out in the Custom Game
      When Alice plays e2-e4 in the Custom Game
      Then Alice is told the Custom Game has finished
      And Bob wins the Custom Game on time

  Rule: The creator may choose an untimed game only before start

    Scenario: A timed choice can become untimed
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And The Custom Game has a timed choice
      When Alice chooses an untimed Custom Game
      Then The Custom Game is unrated and untimed

    Scenario: An active clock cannot be changed
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice chooses an untimed Custom Game
      Then Alice is told the Custom Game has already started
