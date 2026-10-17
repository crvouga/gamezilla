@domain:games
Feature: Finding an opponent after a custom game
  When a participant of a custom game also wants an opponent, they want to finish the custom game first, so nobody plays a custom game and a matched game at once.

  Rule: A participant of a custom game under way finishes it before seeking an opponent

    Background:
      Given Alice has a free account and a connection

    Scenario: A person may seek an opponent once their custom game is finished
      Given Alice has a finished custom game
      When Alice seeks an opponent for the game at 5+0
      Then Alice is waiting for an opponent at 5+0

    Scenario: A participant of a custom game under way cannot seek an opponent
      Given Alice and Bob have a custom game under way
      When Alice seeks an opponent for the game at 5+0
      Then Alice is told to finish her custom game first
      And Alice is not waiting for an opponent
