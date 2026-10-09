@domain:chess
Feature: Offer a multiplayer draw
  When neither person is clearly winning a multiplayer game, one of them
  wants to offer a multiplayer draw, so the game is drawn by agreement only
  if the other person accepts.

  Rule: Either person may offer a multiplayer draw in an unfinished game

    Scenario: White offers Black a multiplayer draw
      Given Alice is White and Bob is Black in a new multiplayer game
      When Alice offers a multiplayer draw
      Then Bob is offered a multiplayer draw

    Scenario: Offering a multiplayer draw twice keeps one offer
      Given Alice has offered Bob a multiplayer draw
      When Alice offers a multiplayer draw
      Then Bob is offered a multiplayer draw
      And the multiplayer game is still unfinished

    Scenario: No multiplayer draw offer is taken once the game is over
      Given Bob resigned multiplayer chess and Alice won
      When Alice offers a multiplayer draw
      Then Alice is told the multiplayer game is over

  Rule: Only the person offered a multiplayer draw may accept it, and the game is then drawn by agreement

    Scenario: Black accepts White's multiplayer draw offer
      Given Alice has offered Bob a multiplayer draw
      When Bob accepts the multiplayer draw
      Then both people see the multiplayer game is drawn by agreement

    Scenario: Offering a multiplayer draw back accepts the waiting offer
      Given Alice has offered Bob a multiplayer draw
      When Bob offers a multiplayer draw
      Then both people see the multiplayer game is drawn by agreement

    Scenario: White cannot accept her own multiplayer draw offer
      Given Alice has offered Bob a multiplayer draw
      When Alice accepts the multiplayer draw
      Then Alice is told only Bob may answer her multiplayer draw offer
      And the multiplayer game is still unfinished

    Scenario: A multiplayer draw nobody offered cannot be accepted
      Given Alice is White and Bob is Black in a new multiplayer game
      When Bob accepts the multiplayer draw
      Then Bob is told no multiplayer draw offer is waiting
      And the multiplayer game is still unfinished

  Rule: The person offered a multiplayer draw may decline it, and the game goes on

    Scenario: Black declines White's multiplayer draw offer
      Given Alice has offered Bob a multiplayer draw
      When Bob declines the multiplayer draw
      Then neither person is offered a multiplayer draw
      And the multiplayer game is still unfinished

    Scenario: White cannot decline her own multiplayer draw offer
      Given Alice has offered Bob a multiplayer draw
      When Alice declines the multiplayer draw
      Then Alice is told only Bob may answer her multiplayer draw offer
      And Bob is offered a multiplayer draw

    Scenario: A multiplayer draw nobody offered cannot be declined
      Given Alice is White and Bob is Black in a new multiplayer game
      When Bob declines the multiplayer draw
      Then Bob is told no multiplayer draw offer is waiting

  Rule: A move by the person offered a multiplayer draw declines it, and a move by the person who offered keeps it

    Scenario: Black's move declines White's multiplayer draw offer
      Given Alice's multiplayer move e2 to e4 was accepted
      And Alice has offered Bob a multiplayer draw
      When Bob plays e7 to e5 as a multiplayer move
      Then neither person is offered a multiplayer draw

    Scenario: White's own move keeps her multiplayer draw offer
      Given Alice is White and Bob is Black in a new multiplayer game
      And Alice has offered Bob a multiplayer draw
      When Alice plays e2 to e4 as a multiplayer move
      Then Bob is offered a multiplayer draw
