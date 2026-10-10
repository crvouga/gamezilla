@domain:chess
Feature: Play the same multiplayer board together
  When two people have been matched, they want an honest game that survives
  time away, so only the person whose turn it is can move and both people
  keep the same moves and multiplayer result.

  Rule: Only a legal move by the person whose turn it is changes the board

    Scenario: White's first legal move passes the turn to Black
      Given Alice is White and Bob is Black in a new multiplayer game
      When Alice plays e2 to e4 as a multiplayer move
      Then both multiplayer boards show the white pawn on e4
      And Bob has the multiplayer turn

    Scenario: Black cannot make the first multiplayer move
      Given Alice is White and Bob is Black in a new multiplayer game
      When Bob plays e7 to e5 as a multiplayer move
      Then Bob is told it is not his multiplayer turn
      And both multiplayer boards keep their starting position

    Scenario: An illegal move keeps the turn and board
      Given Alice is White and Bob is Black in a new multiplayer game
      When Alice plays e2 to e5 as a multiplayer move
      Then Alice is told that multiplayer move is illegal
      And both multiplayer boards keep their starting position
      And Alice has the multiplayer turn

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

  Rule: Once both people have made their first move, either person may resign an unfinished game

    Scenario: A person resigns outside their turn
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      When Bob resigns multiplayer chess
      Then both people see Alice won the multiplayer game

    Scenario: Resigning again keeps the accepted multiplayer result
      Given Bob resigned multiplayer chess and Alice won
      When Bob resigns multiplayer chess
      Then both people see Alice won the multiplayer game

  Rule: A multiplayer game that is over never accepts another move

    Scenario: Checkmate gives both people the same multiplayer win
      Given Alice is White and Bob is Black after multiplayer moves f3, e5, g4
      When Bob plays d8 to h4 as a multiplayer move
      Then both people see Bob won the multiplayer game by checkmate

    Scenario: A move after resigning multiplayer chess is refused
      Given Bob resigned multiplayer chess and Alice won
      When Alice plays e2 to e4 as a multiplayer move
      Then Alice is told the multiplayer game is over
      And both multiplayer boards keep their starting position

  Rule: Both people see every accepted move in the multiplayer move list, kept with the multiplayer result

    Scenario: An accepted move joins both people's multiplayer move list
      Given Alice's multiplayer move e2 to e4 was accepted
      And Bob's multiplayer move e7 to e5 was accepted
      When Alice plays g1 to f3 as a multiplayer move
      Then both people see the multiplayer move list "1. e4 e5 2. Nf3"

    Scenario: An illegal move never joins the multiplayer move list
      Given Alice's multiplayer move e2 to e4 was accepted
      When Bob plays e7 to e4 as a multiplayer move
      Then Bob is told that multiplayer move is illegal
      And both people see the multiplayer move list "1. e4"

    Scenario: The multiplayer move list is kept with the multiplayer result
      Given Bob resigned multiplayer chess after the multiplayer moves e4 and e5
      When Alice opens multiplayer chess on another device
      Then Alice sees she won the multiplayer game
      And Alice sees the multiplayer move list "1. e4 e5"

  Rule: A multiplayer game is drawn automatically by stalemate, repetition, insufficient mating material or fifty moves

    Scenario: Stalemate ends the multiplayer game in a multiplayer draw
      Given Alice and Bob have a multiplayer position one move from stalemate
      When the person whose turn it is plays that multiplayer move
      Then both people see the multiplayer game is drawn by stalemate

    Scenario: A position repeated for the third time ends in a multiplayer draw
      Given Alice and Bob have a multiplayer position one move from its third appearance
      When the person whose turn it is plays that multiplayer move
      Then both people see the multiplayer game is drawn by repetition

    Scenario: A position's second appearance keeps the game unfinished
      Given Alice and Bob have a multiplayer position one move from its second appearance
      When the person whose turn it is plays that multiplayer move
      Then the multiplayer game is still unfinished

    Scenario: Insufficient mating material ends in a multiplayer draw
      Given Alice and Bob have a multiplayer position one move from insufficient mating material
      When the person whose turn it is plays that multiplayer move
      Then both people see the multiplayer game is drawn by insufficient mating material

    Scenario: Fifty moves without a pawn move or capture end in a multiplayer draw
      Given Alice and Bob have a multiplayer position one move from fifty moves without a pawn move or capture
      When the person whose turn it is plays that multiplayer move
      Then both people see the multiplayer game is drawn by fifty moves

