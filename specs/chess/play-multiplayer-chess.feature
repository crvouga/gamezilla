@domain:chess
Feature: Multiplayer results by the rules of chess
  When the rules of chess decide a multiplayer game, both people want the
  same multiplayer result at once, so the multiplayer game is over for both
  of them.

  Rule: Checkmate gives a multiplayer win, and stalemate, repetition, insufficient mating material or fifty moves give a multiplayer draw automatically

    Scenario: Checkmate gives both people the same multiplayer win
      Given Alice is White and Bob is Black after multiplayer moves f3, e5, g4
      When Bob plays d8 to h4 as a multiplayer move
      Then both people see Bob won the multiplayer game by checkmate

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
