@domain:chess
Feature: Play the same multiplayer board together
  When two people have been matched, they want an honest game that survives
  time away, so only the person whose turn it is can move and both people
  keep the same moves and result.

  Rule: Only a legal move by the person whose turn it is changes the board

    Scenario: White's first legal move passes the turn to Black
      Given Alice is White and Bob is Black in a new multiplayer game
      When Alice plays e2 to e4 as a multiplayer move
      Then both multiplayer boards show the white pawn on e4
      And Bob has the multiplayer turn

    Scenario: Black cannot move first
      Given Alice is White and Bob is Black in a new multiplayer game
      When Bob plays e7 to e5 as a multiplayer move
      Then Bob is told it is not his multiplayer turn
      And both multiplayer boards keep their starting position

    Scenario: An illegal move keeps the turn and board
      Given Alice is White and Bob is Black in a new multiplayer game
      When Alice plays e2 to e5 as a multiplayer move
      Then Alice is told that multiplayer move is illegal
      And both multiplayer boards keep their starting position
      And Alice still has the multiplayer turn

  Rule: A move sent twice or for an earlier position never moves the board twice

    Scenario: Repeating an accepted move keeps its one effect
      Given Alice's multiplayer move e2 to e4 was accepted
      When Alice repeats that multiplayer move
      Then both multiplayer boards show one move
      And Bob has the multiplayer turn

    Scenario: Another device's move for an earlier board is refused
      Given Alice's multiplayer move e2 to e4 was accepted
      And Bob's multiplayer move e7 to e5 was accepted
      When Alice plays d2 to d4 for her earlier multiplayer position
      Then Alice is told her multiplayer board has changed
      And both multiplayer boards still show two moves

  Rule: Either person may resign an unfinished game

    Scenario: A person resigns outside their turn
      Given Alice is White and Bob is Black in a new multiplayer game
      When Bob resigns multiplayer chess
      Then both people see Alice won the multiplayer game

    Scenario: Repeating a resignation keeps the accepted result
      Given Bob resigned multiplayer chess and Alice won
      When Bob resigns multiplayer chess again
      Then both people still see Alice won the multiplayer game

  Rule: A multiplayer game that is over never accepts another move

    Scenario: Checkmate gives both people the same winner
      Given Alice is White and Bob is Black after multiplayer moves f3, e5, g4
      When Bob plays d8 to h4 as a multiplayer move
      Then both people see Bob won the multiplayer game by checkmate

    Scenario: A move after resignation is refused
      Given Bob resigned multiplayer chess and Alice won
      When Alice plays e2 to e4 as a multiplayer move
      Then Alice is told the multiplayer game is over
      And both multiplayer boards keep their starting position

  Rule: This casual game automatically draws at its draw boundaries

    Scenario: Stalemate finishes the multiplayer game as a draw
      Given Alice and Bob have a multiplayer position one move from stalemate
      When the person whose turn it is plays that multiplayer move
      Then both people see the multiplayer game is drawn by stalemate

    Scenario: A repeated position for the third time finishes as a draw
      Given Alice and Bob have a multiplayer position one move from its third appearance
      When the person whose turn it is plays that multiplayer move
      Then both people see the multiplayer game is drawn by repetition

    Scenario: A position's second appearance keeps the game unfinished
      Given Alice and Bob have a multiplayer position one move from its second appearance
      When the person whose turn it is plays that multiplayer move
      Then the multiplayer game is still unfinished

    Scenario: Insufficient mating material finishes as a draw
      Given Alice and Bob have a multiplayer position one move from insufficient mating material
      When the person whose turn it is plays that multiplayer move
      Then both people see the multiplayer game is drawn by insufficient mating material

    Scenario: Fifty moves without a pawn move or capture finishes as a draw
      Given Alice and Bob have a multiplayer position one move from fifty moves without a pawn move or capture
      When the person whose turn it is plays that multiplayer move
      Then both people see the multiplayer game is drawn by fifty moves

