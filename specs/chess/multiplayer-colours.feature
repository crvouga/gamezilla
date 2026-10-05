@domain:chess
Feature: Fair colours in multiplayer chess
  When two people are matched, they want White and Black shared out fairly
  over their games, so nobody keeps getting the same colour.

  Rule: Of two matched people, the one with the greater colour balance plays Black
    No counter-example: people never choose their colour, so nothing a person does can break this.

    Scenario: The person who played White last time plays Black
      Given Alice played White and Bob played Black in their only multiplayer games
      And Alice and Bob are looking for 5+0 chess opponents
      When a matchmaking match is formed for Alice and Bob
      Then Alice is Black and Bob is White in their new multiplayer game

    Scenario: Looking for a chess opponent first does not earn White
      Given Alice played White in her only multiplayer game and Bob has played none
      And Alice began looking for a 5+0 chess opponent before Bob did
      When a matchmaking match is formed for Alice and Bob
      Then Alice is Black and Bob is White in their new multiplayer game

  Rule: With equal colour balances either person may be White
    No counter-example: both colour choices are fair, so neither is refused.

    Scenario: Two people who each played White once get opposite colours
      Given Alice and Bob each played White in their only multiplayer game
      And Alice and Bob are looking for 5+0 chess opponents
      When a matchmaking match is formed for Alice and Bob
      Then one is White and the other is Black
      And White has the first multiplayer turn
