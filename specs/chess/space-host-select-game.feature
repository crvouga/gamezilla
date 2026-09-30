@domain:chess
Feature: The host chooses what the space plays
  When a host picks a game, everyone in the space wants to be taken to it,
  so what the space plays is the host's choice and nobody else has to pick.

  Rule: The host's game is the game everyone in the space is taken to
    No counter-example: only the host chooses the game, so nobody else's choice can disagree.

    Scenario: The host picks chess and everyone in the space is taken to it
    Given Alice is hosting a space that Bob joined from the link
    When Alice picks chess for the space
    Then Bob is taken to chess within 15 seconds
