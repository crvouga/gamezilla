@domain:word-tiles
Feature: Keep racks private
  When Alice plays Word Tiles, she wants only herself to see her tiles, so no player can plan against tiles they should not know.

  Rule: Other players see how many tiles a player holds, never which

    Scenario: Bob sees how many tiles Alice holds but none of her letters
      Given Alice and Bob have started Word Tiles with Alice holding Q, Z, J, X, K, V and W
      When Alice passes
      Then Bob sees that Alice holds seven tiles
      And Bob sees none of Alice's tiles

    Scenario: Bob cannot exchange tiles Alice holds
      Given Alice and Bob have started Word Tiles with Alice holding Q, Z, J, X, K, V and W and Alice has passed
      When Bob exchanges Q
      Then Bob is told he does not hold those tiles
      And Alice still holds Q, Z, J, X, K, V and W
