@domain:journeys
Feature: Play Pong again with the same person
  When Alice and Bob want to keep playing Pong together, they want to finish their game and accept a rematch, so they can play again with the paddles swapped.

  Rule: Finishing Pong leads into another game with the same target score

    Scenario: Two people finish Pong and accept a rematch
      When Alice and Bob play Pong from fresh devices
      Then Alice and Bob see Alice has won Pong
      When Bob offers a rematch
      When Alice accepts the rematch
      Then Alice and Bob see a new Pong game with their paddles swapped and both scores at zero
      And Pong keeps the same target score
