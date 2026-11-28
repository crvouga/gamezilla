@domain:games
Feature: Keep a game session between two people through a pause
  When neither participant can go on with a game session, they want the same board and time kept, so a pause cannot give either of them a victory.

  Rule: A paused game session between two people keeps its time and has no winner

    Scenario: A pause cannot decide a timed game session
      Given Alice and Bob have a game session under way played at 1+0
      And 20 seconds have passed
      And the first side has 40 seconds and the second side has 60 seconds
      And the game session is paused
      When 60 seconds pass
      Then the first side has 40 seconds and the second side has 60 seconds
      And the game session remains under way
      And neither person has won the game session

    Scenario: A pause does not let a participant claim the win
      Given Alice and Bob have a game session under way
      And the game session is paused
      And 60 seconds have passed
      When Alice claims the win
      Then Alice is told the game session is paused
      And the game session remains under way
      And neither person has won the game session

    Scenario: An untimed game session also stays unfinished while it is paused
      Given Alice and Bob have a game session under way
      And the game session is paused
      When 60 seconds pass
      Then the game session remains under way
      And neither person has won the game session
      And neither participant is offered to claim the win
