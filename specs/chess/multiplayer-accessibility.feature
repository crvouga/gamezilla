@domain:chess
Feature: Move a piece in multiplayer chess with the keyboard alone
  When a person uses only the keyboard, they want to move their pieces in multiplayer chess, so they can play without a mouse.

  Rule: A multiplayer move can be made with the keyboard alone
    No counter-example: keyboard access is always available, regardless of a game's multiplayer result.

    Scenario: A person using the keyboard can move a piece
      Given Alice is White after e4 and e5 in a 5+0 multiplayer game and is using the keyboard alone
      When Alice plays g1 to f3 as a multiplayer move with the keyboard
      Then Bob has the multiplayer turn
