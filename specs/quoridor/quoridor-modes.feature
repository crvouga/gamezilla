@domain:quoridor
Feature: Choose a Quoridor mode
  When Alice chooses Quoridor, she wants the players and goal made clear, so everyone begins with the same rules.

  Rule: Classic starts with two opposed players and ten walls each
    No counter-example: starting with too few or too many players is refused by the shared game readiness rules.

    Scenario: Classic begins with opposed pawns and equal wall inventories
      Given Alice has chosen Classic Quoridor
      When Alice creates a Quoridor custom game
      Then the Quoridor board has nine columns and nine rows
      And South begins on e1 and North begins on e9 with ten walls each
      And South has the Quoridor turn and each goal is the opposite home row

  Rule: King of the Hill starts with four players and five walls each
    No counter-example: starting with too few or too many players is refused by the shared game readiness rules.

    Scenario: The four players begin at the middle of the four edges
      Given Alice has chosen Four-Player King of the Hill
      When Alice creates a Quoridor custom game
      Then South begins on e1, West on a5, North on e9 and East on i5 with five walls each
      And the Quoridor turn order is South, West, North, East
      And the Quoridor hill is the single square e5 and first arrival wins
