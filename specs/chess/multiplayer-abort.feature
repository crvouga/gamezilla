@domain:chess
Feature: Abort a multiplayer game before it begins
  When a multiplayer game has not really begun, people want to end it with no
  multiplayer result, so nobody loses a game that never started.

  Rule: Either person may abort the multiplayer game until both people have made their first move

    Scenario: Black aborts before either person has moved
      Given Alice is White and Bob is Black in a new multiplayer game
      When Bob aborts the multiplayer game
      Then both people see the multiplayer game was aborted

    Scenario: White aborts after her first move but before Black's
      Given Alice's multiplayer move e2 to e4 was accepted
      When Alice aborts the multiplayer game
      Then both people see the multiplayer game was aborted

    Scenario: Aborting is refused once both people have moved
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      When Alice aborts the multiplayer game
      Then Alice is told the multiplayer game can no longer be aborted
      And the multiplayer game is still unfinished

    Scenario: A game that is over cannot be aborted
      Given Bob resigned multiplayer chess and Alice won
      When Alice aborts the multiplayer game
      Then Alice is told the multiplayer game is over
      And both people still see Alice won the multiplayer game

  Rule: Resigning is refused until both people have made their first move, and the person is told to abort instead

    Scenario: Black cannot resign before either person has moved
      Given Alice is White and Bob is Black in a new multiplayer game
      When Bob resigns multiplayer chess
      Then Bob is told to abort the multiplayer game instead
      And the multiplayer game is still unfinished

    Scenario: Black cannot resign after only White's first move
      Given Alice's multiplayer move e2 to e4 was accepted
      When Bob resigns multiplayer chess
      Then Bob is told to abort the multiplayer game instead
      And the multiplayer game is still unfinished

    Scenario: Black may resign once both people have moved
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      When Bob resigns multiplayer chess
      Then both people see Alice won the multiplayer game

  Rule: Missing the first move aborts the multiplayer game

    Scenario: White misses the first move after 30 seconds
      Given Alice is White and Bob is Black in a new multiplayer game
      When 30 seconds pass in multiplayer chess
      Then both people see the multiplayer game was aborted

    Scenario: Black misses the first move 30 seconds after White's
      Given Alice's multiplayer move e2 to e4 was accepted
      When 30 seconds pass in multiplayer chess
      Then both people see the multiplayer game was aborted

    Scenario: White still has time for the first move after 29 seconds
      Given Alice is White and Bob is Black in a new multiplayer game
      When 29 seconds pass in multiplayer chess
      Then the multiplayer game is still unfinished

    Scenario: Black's 30 seconds start from White's first move
      Given Alice's multiplayer move e2 to e4 was accepted 25 seconds after the game started
      When 29 seconds pass in multiplayer chess
      Then the multiplayer game is still unfinished

  Rule: An aborted game has no multiplayer result, moves no multiplayer rating and frees both people to find a chess opponent

    Scenario: A person matched while their phone was offline does not lose the game
      Given Alice is White in a new 5+0 multiplayer game with Bob and her phone has been offline since they were matched
      When 30 seconds pass in multiplayer chess
      Then both people see the multiplayer game was aborted
      And neither person's blitz rating has moved

    Scenario: After an aborted game a person may find a chess opponent again
      Given Alice's 5+0 multiplayer game with Bob was aborted
      When Alice finds a chess opponent for 5+0
      Then Alice is looking for a 5+0 chess opponent

    Scenario: Aborting an aborted game again changes nothing
      Given Alice's 5+0 multiplayer game with Bob was aborted
      When Alice aborts the multiplayer game
      Then both people still see the multiplayer game was aborted

    Scenario: An aborted game cannot be resigned
      Given Alice's 5+0 multiplayer game with Bob was aborted
      When Bob resigns multiplayer chess
      Then Bob is told the multiplayer game is over
      And both people still see the multiplayer game was aborted
