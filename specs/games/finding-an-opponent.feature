@domain:games
Feature: Finding an opponent in every game
  When Alice wants another player, she wants an opponent for the game she chose at the same clock choice, so the pair can start playing together.

  Rule: People are paired only for the same game at the same clock choice

    Scenario: Compatible people receive one new game on opposite sides
      Given Alice and Bob are seeking an opponent for the game at the same clock choice
      When they are paired
      Then Alice and Bob receive the same new game on opposite sides

    Scenario: Someone seeking another game is never paired for this one
      Given Alice seeks an opponent for the game and Bob seeks an opponent for another game
      When they are paired
      Then Alice and Bob are not paired together

  Rule: Someone who stops seeking is no longer waiting
    No counter-example: an opponent already found keeps the game they were given.

    Scenario: Alice is no longer waiting once she stops seeking
      Given Alice is seeking an opponent for the game
      When Alice stops seeking an opponent
      Then Alice is no longer waiting for an opponent
