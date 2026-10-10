@domain:chess
Feature: A multiplayer rematch after the game
  When a multiplayer game is over, its two people may want to play again at
  once, so a multiplayer rematch starts a new game between them without a
  new search.

  Rule: After a finished multiplayer game either person may offer a multiplayer rematch while neither plays another game

    Scenario: Bob offers Alice a multiplayer rematch after their game is over
      Given Alice's 5+0 multiplayer game with Bob is over
      When Bob offers a multiplayer rematch
      Then Alice is offered a multiplayer rematch

    Scenario: An aborted game has no multiplayer rematch
      Given Alice's 5+0 multiplayer game with Bob was aborted
      When Bob offers a multiplayer rematch
      Then Bob is told an aborted multiplayer game has no multiplayer rematch

    Scenario: A multiplayer rematch cannot be offered while the game is unfinished
      Given Alice has an unfinished multiplayer game with Bob
      When Bob offers a multiplayer rematch
      Then Bob is told the multiplayer game is not over yet

    Scenario: A multiplayer rematch is refused once the other person plays another game
      Given Alice's 5+0 multiplayer game with Bob is over
      And Alice has since started an unfinished multiplayer game with Carol
      When Bob offers a multiplayer rematch
      Then Bob is told Alice is already playing another multiplayer game

    Scenario: A person looking for a chess opponent cannot offer a multiplayer rematch
      Given Alice's 5+0 multiplayer game with Bob is over
      And Bob is looking for a 5+0 chess opponent
      When Bob offers a multiplayer rematch
      Then Bob is told he is already looking for a chess opponent

    Scenario: A multiplayer rematch is refused once the other person is looking for a chess opponent
      Given Alice's 5+0 multiplayer game with Bob is over
      And Alice is looking for a 5+0 chess opponent
      When Bob offers a multiplayer rematch
      Then Bob is told Alice is already looking for a chess opponent

  Rule: Accepting a multiplayer rematch starts a new game at the same time control with the colours swapped

    Scenario: Accepting a multiplayer rematch swaps the colours and keeps 5+0
      Given Alice was White and Bob was Black in their finished 5+0 multiplayer game
      And Bob has offered Alice a multiplayer rematch
      When Alice accepts the multiplayer rematch
      Then Alice is Black and Bob is White in their new multiplayer game
      And both people see their multiplayer game is played at 5+0

    Scenario: Offering a multiplayer rematch back accepts the waiting offer
      Given Alice was White and Bob was Black in their finished 5+0 multiplayer game
      And Bob has offered Alice a multiplayer rematch
      When Alice offers a multiplayer rematch
      Then Alice is Black and Bob is White in their new multiplayer game

    Scenario: Bob cannot accept his own multiplayer rematch offer
      Given Alice's 5+0 multiplayer game with Bob is over
      And Bob has offered Alice a multiplayer rematch
      When Bob accepts the multiplayer rematch
      Then Bob is told only Alice may answer his multiplayer rematch offer

  Rule: A multiplayer rematch offer ends when either person declines it or finds a chess opponent

    Background:
      Given Alice's 5+0 multiplayer game with Bob is over

    Scenario: Alice declines Bob's multiplayer rematch offer
      Given Bob has offered Alice a multiplayer rematch
      When Alice declines the multiplayer rematch
      Then neither person is offered a multiplayer rematch

    Scenario: Bob cannot decline his own multiplayer rematch offer
      Given Bob has offered Alice a multiplayer rematch
      When Bob declines the multiplayer rematch
      Then Bob is told only Alice may answer his multiplayer rematch offer
      And Alice is offered a multiplayer rematch

    Scenario: Finding a new opponent ends a waiting multiplayer rematch offer
      Given Bob has offered Alice a multiplayer rematch
      When Bob finds a new opponent
      Then neither person is offered a multiplayer rematch
      And Bob is looking for a 5+0 chess opponent

    Scenario: An ended multiplayer rematch offer can no longer be accepted
      Given Bob's multiplayer rematch offer ended when he found a new opponent
      When Alice accepts the multiplayer rematch
      Then Alice is told the multiplayer rematch offer has ended
