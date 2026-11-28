@domain:games
Feature: Finding an opponent after a game session
  When a participant of a game session also wants an opponent, they want to finish the game session first, so nobody plays a game session and a matched game at once.

  Rule: A participant of a game session under way finishes it before seeking an opponent

    Background:
      Given Alice has a free account and a connection

    Scenario: A person may seek an opponent once their game session is finished
      Given Alice has a finished game session
      When Alice seeks an opponent for the game at 5+0
      Then Alice is waiting for an opponent at 5+0

    Scenario: A participant of a game session under way cannot seek an opponent
      Given Alice and Bob have a game session under way
      When Alice seeks an opponent for the game at 5+0
      Then Alice is told to finish her game session first
      And Alice is offered to return to the game session
      And Alice is not waiting for an opponent
