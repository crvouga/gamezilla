@domain:connect-four @synthetic
Feature: Connect Four remains available
  When people play Connect Four, the team wants playable games and opponents, so trouble is detected before more people encounter it.

  Rule: The environment supports a complete Connect Four game

    Scenario: Connect Four can be started and completed
      When the team checks Connect Four in this environment
      Then two people can find each other and complete Connect Four with the same result
