@domain:journeys
Feature: Play Quoridor with other people
  When Alice wants a game with other people, they want to find each other and play Quoridor, so everyone sees the same finished game.

  Rule: Two people can find each other and finish Classic Quoridor
    No counter-example: refusals and interrupted play are covered by the Quoridor and shared game rules.

    Scenario: Two people share the completed Classic game
      When Alice and Bob play Classic Quoridor from fresh devices
      Then Alice and Bob see the same completed Classic Quoridor game

  Rule: Four people can find each other and finish King of the Hill
    No counter-example: refusals and interrupted play are covered by the Quoridor and shared game rules.

    Scenario: Four people share the completed King of the Hill game
      When Alice, Bob, Carol and Dave play Four-Player King of the Hill from fresh devices
      Then Alice, Bob, Carol and Dave see the same completed Four-Player King of the Hill game
