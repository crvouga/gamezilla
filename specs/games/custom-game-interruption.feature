@domain:games
Feature: Keep a custom game between two people through a pause
  When neither participant can go on with a custom game, they want the same board and time kept, so a pause cannot give either of them a victory.

  Rule: A paused custom game between two people keeps its time and has no winner

    Scenario: A pause cannot decide a timed custom game
      Given Alice and Bob have a custom game under way played at 1+0
      And 20 seconds have passed
      And the first side has 40 seconds and the second side has 60 seconds
      And the custom game is paused
      When 60 seconds pass
      Then the first side has 40 seconds and the second side has 60 seconds
      And the custom game remains under way
      And neither person has won the custom game

    Scenario: A pause does not let a participant claim the win
      Given Alice and Bob have a custom game under way
      And the custom game is paused
      And 60 seconds have passed
      When Alice claims the win
      Then Alice is told the custom game is paused
      And the custom game remains under way
      And neither person has won the custom game

    Scenario: An untimed custom game also stays unfinished while it is paused
      Given Alice and Bob have a custom game under way
      And the custom game is paused
      When 60 seconds pass
      Then the custom game remains under way
      And neither person has won the custom game
      And neither participant is offered to claim the win
