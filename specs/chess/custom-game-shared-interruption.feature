@domain:chess
Feature: Keep a shared Custom Game through interruption
  When neither participant can continue a Custom Game, they want the same board and time kept, so an interruption cannot give either person a win.

  Rule: A paused Custom Game between people preserves its time and has no winner

    Scenario: A pause cannot decide a timed Custom Game
      Given Alice has an active Custom Game with 1 minute and 0 seconds increment
      And 20 seconds have passed in the Custom Game
      And White has 40 seconds and Black has 60 seconds in the Custom Game
      And the Custom Game's clocks are paused
      When 60 seconds pass
      Then White has 40 seconds and Black has 60 seconds in the Custom Game
      And the Custom Game remains active without a winner

    Scenario: Being unable to play together does not permit an away win
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And the Custom Game's clocks are paused
      And 60 seconds have passed in the Custom Game
      When Alice claims the win in the Custom Game
      Then Alice is told the Custom Game is temporarily unavailable
      And the Custom Game remains active without a winner

    Scenario: An untimed shared game also stays unfinished while nobody can play
      Given Alice has an active untimed Custom Game between Alice as White and Bob as Black
      And the Custom Game cannot currently be played by either participant
      When 60 seconds pass
      Then the Custom Game remains active without a winner
      And neither participant is offered to claim an away win

