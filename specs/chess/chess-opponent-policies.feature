@domain:chess
Feature: Chess opponents respect the person's other choices
  When a person finds a chess opponent, they want their account, blocks and
  puzzles respected, so multiplayer chess follows those existing choices.

  Rule: Blocking in either direction prevents a new chess pairing

    Scenario: People who have not blocked each other can be paired
      Given Alice and Bob are looking for chess opponents
      When a matchmaking match is formed for Alice and Bob
      Then Alice and Bob have the same multiplayer game

    Scenario: Blocking before pairing keeps both people seeking other opponents
      Given Alice and Bob are looking for chess opponents
      And Alice blocked Bob
      When matchmaking pairs people up
      Then Alice and Bob are still looking for other chess opponents
      And Bob is not told Alice blocked him

    Scenario: A block after pairing does not erase the game
      Given Alice blocked Bob after their multiplayer game was formed
      When Alice opens multiplayer chess
      Then Alice keeps her multiplayer game with Bob

  Rule: Paid access does not govern ordinary multiplayer chess

    Scenario: A Plus member can find an opponent
      Given Alice is a Plus member with a connection
      When Alice finds a chess opponent
      Then Alice is looking for a chess opponent

    Scenario: Losing paid access does not remove an opponent search
      Given Alice no longer has paid access while she was looking for a chess opponent
      When Alice opens multiplayer chess
      Then Alice is still looking for a chess opponent

  Rule: Multiplayer chess is separate from puzzles in a space

    Scenario: Looking for an opponent keeps the space's puzzle as it was
      Given Alice and Bob are playing a puzzle in a space
      When Alice finds a chess opponent
      Then Bob keeps the same puzzle in the space
      And Alice is looking for a chess opponent

    Scenario: A multiplayer result does not move a puzzle rating
      Given Alice has a puzzle rating of 1700 and an unfinished multiplayer game
      When Alice resigns multiplayer chess
      Then Alice's puzzle rating is still 1700
      And Alice's multiplayer rating is still 1500
