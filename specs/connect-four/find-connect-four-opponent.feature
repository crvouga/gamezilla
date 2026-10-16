@domain:connect-four
Feature: Find a Connect Four opponent
  When Alice wants another player, she wants a compatible Connect Four opponent, so the pair can start playing together.

  Rule: Matchmaking pairs only the same game and clock choice

    Scenario: Compatible people receive one playable game
      Given Alice and Bob are seeking Connect Four at the same clock choice
      When they are paired for Connect Four
      Then Alice and Bob receive the same Connect Four game with opposite sides

    Scenario: A chess search cannot become a Connect Four game
      Given Alice seeks Connect Four and Bob seeks chess
      When opponents are paired
      Then Alice and Bob are not paired together

  Rule: A stopped search cannot create a later game
    No counter-example: an already agreed pairing follows the established assignment policy.

    Scenario: Stopping a waiting search ends the wait
      Given Alice is seeking a Connect Four opponent
      When Alice stops seeking a Connect Four opponent
      Then Alice is no longer waiting for Connect Four
