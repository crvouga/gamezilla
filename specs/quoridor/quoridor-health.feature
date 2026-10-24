@domain:quoridor @synthetic
Feature: Both Quoridor modes remain available
  When people play Quoridor, the team wants complete games in each mode, so trouble is detected before more people encounter it.

  Rule: The environment supports a complete Classic Quoridor game

    Scenario: Classic can be started and completed by two people
      When the team checks Classic Quoridor in this environment
      Then two people can find each other and complete Classic Quoridor with the same result

  Rule: The environment supports a complete Four-Player King of the Hill game

    Scenario: King of the Hill can be completed by people and bots
      When the team checks Four-Player King of the Hill in this environment
      Then two people and two bots can complete Four-Player King of the Hill with the same result
