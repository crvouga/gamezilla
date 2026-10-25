@domain:word-tiles
Feature: Take turns at Word Tiles
  When Alice cannot or does not want to place a word, she wants to pass or exchange tiles, so the game goes on and her rack stays full.

  Rule: A player may pass instead of placing a word
    No counter-example: every player can pass on their turn until the game is over.

    Scenario: Passing gives the turn to the next player and keeps every tile
      Given Alice and Bob have started Word Tiles with Alice holding C, A, T, D, O, G and S
      When Alice passes
      Then Bob has the turn
      And Alice still holds C, A, T, D, O, G and S

  Rule: An exchange needs at least seven tiles in the bag

    Scenario: Alice exchanges two tiles for two from the bag
      Given Alice and Bob have started Word Tiles with Alice holding Q, Z, J, X, K, V and W
      When Alice exchanges Q and Z
      Then Alice holds seven tiles without Q or Z
      And the bag holds 86 tiles
      And Bob has the turn

    Scenario: An exchange with six tiles in the bag is refused
      Given Alice and Bob are playing Word Tiles with six tiles in the bag and Alice holding Q, Z, J, X, K, V and W
      When Alice exchanges Q
      Then Alice is told the bag holds too few tiles to exchange
      And Alice still holds Q, Z, J, X, K, V and W

  Rule: After a placement the rack is filled from the bag back to seven tiles
    No counter-example: a placement always fills the rack with as many tiles as the bag holds.

    Scenario: The rack is filled back to seven tiles
      Given Alice and Bob have started Word Tiles with Alice holding C, A, T, D, O, G and S
      When Alice places CAT from g8 to i8
      Then Alice holds seven tiles
      And the bag holds 83 tiles

    Scenario: A bag with two tiles fills only two
      Given Alice and Bob are playing Word Tiles with two tiles in the bag and Alice holding C, A, T, D, O, G and S
      When Alice places CAT from g8 to i8
      Then Alice holds six tiles
      And the bag holds 0 tiles

  Rule: Only the player who has the turn may take it

    Scenario: Bob takes his turn after Alice passes
      Given Alice and Bob have started Word Tiles with Alice holding C, A, T, D, O, G and S and Alice has passed
      When Bob passes
      Then Alice has the turn

    Scenario: Bob cannot take a turn while Alice has the turn
      Given Alice and Bob have started Word Tiles with Alice holding C, A, T, D, O, G and S
      When Bob passes
      Then Bob is told it is not his turn
      And Alice has the turn
