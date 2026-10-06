@domain:chess
Feature: Choose a time control for multiplayer chess
  When a person looks for a chess opponent, they want to choose how fast the
  game is played, so they only meet someone who wants the same time control.

  Rule: Finding a chess opponent needs one of the offered time controls

    Scenario: A person looks for a chess opponent at the time control they chose
      Given Alice has a free account and a connection
      When Alice finds a chess opponent for 5+0
      Then Alice is looking for a 5+0 chess opponent

    Scenario: A time control that is not offered is refused
      Given Alice has a free account and a connection
      When Alice finds a chess opponent for 4+0
      Then Alice is told 4+0 is not an offered time control
      And Alice is not looking for a chess opponent

    Scenario: A person already looking cannot start a second search
      Given Alice is looking for a 5+0 chess opponent
      When Alice finds a chess opponent for 3+2
      Then Alice is told she is already looking for a chess opponent
      And Alice is still looking for a 5+0 chess opponent

  Rule: People are matched only with someone looking for the same time control

    Scenario: Two people looking for 5+0 get a 5+0 multiplayer game
      Given Alice and Bob are looking for 5+0 chess opponents
      When matchmaking pairs people up
      Then Alice and Bob have the same multiplayer game
      And both people see their multiplayer game is played at 5+0

    Scenario: A 5+0 search is never matched with a 3+2 search
      Given Alice is looking for a 5+0 chess opponent
      And Bob is looking for a 3+2 chess opponent
      When matchmaking pairs people up
      Then Alice and Bob are still looking for other chess opponents

  Rule: After a game is over or aborted, a person finds a new opponent at the same time control in one step

    Scenario: A new opponent search keeps the time control of a game that is over
      Given Alice's 5+0 multiplayer game with Bob is over
      When Alice finds a new opponent
      Then Alice is looking for a 5+0 chess opponent

    Scenario: A new opponent search keeps an aborted game's time control
      Given Alice's 3+2 multiplayer game with Bob was aborted
      When Bob finds a new opponent
      Then Bob is looking for a 3+2 chess opponent

    Scenario: A person already looking cannot find a new opponent as well
      Given Alice's 5+0 multiplayer game with Bob is over
      And Alice is looking for a 3+2 chess opponent
      When Alice finds a new opponent
      Then Alice is told she is already looking for a chess opponent
      And Alice is still looking for a 3+2 chess opponent

    Scenario: A new opponent cannot be found during an unfinished game
      Given Alice has an unfinished multiplayer game with Bob
      When Alice finds a new opponent
      Then Alice is told to finish her multiplayer game first
      And Alice keeps her multiplayer game with Bob
