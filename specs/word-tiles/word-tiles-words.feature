@domain:word-tiles
Feature: Place words on the board
  When Alice places tiles from her rack, she wants every word checked against the word list and joined to the board, so every player builds on the same board.

  Rule: The first word covers the centre square

    Scenario: A first word across the centre square is placed
      Given Alice and Bob have started Word Tiles with Alice holding C, A, T, D, O, G and S
      When Alice places CAT from g8 to i8
      Then the board shows CAT from g8 to i8
      And Bob has the turn

    Scenario: A first word away from the centre square is refused
      Given Alice and Bob have started Word Tiles with Alice holding C, A, T, D, O, G and S
      When Alice places CAT from a1 to c1
      Then Alice is told her first word must cover the centre square
      And Alice still holds C, A, T, D, O, G and S

  Rule: Every word a placement forms is in the word list

    Scenario: A placement whose words are all in the word list is placed
      Given the board shows CAT from g8 to i8 with Alice holding A, S, E, D, O, G and R
      When Alice places AS from j7 to j8
      Then the board shows AS from j7 to j8 and CATS from g8 to j8

    Scenario: A word missing from the word list is refused
      Given Alice and Bob have started Word Tiles with Alice holding Z, Q, J, X, K, V and W
      When Alice places ZQ from h8 to i8
      Then Alice is told ZQ is not in the word list
      And the board is still empty

  Rule: A later word joins the tiles on the board in one line

    Scenario: A word built through the tiles on the board is placed
      Given the board shows CAT from g8 to i8 with Alice holding S, S, E, D, O, G and R
      When Alice places SCATS from f8 to j8
      Then the board shows SCATS from f8 to j8

    Scenario: A word apart from the tiles on the board is refused
      Given the board shows CAT from g8 to i8 with Alice holding S, S, E, D, O, G and R
      When Alice places DOG from a1 to c1
      Then Alice is told her word must join the tiles on the board
      And the board still shows only CAT from g8 to i8

    Scenario: Tiles placed in two rows are refused
      Given Alice and Bob have started Word Tiles with Alice holding C, A, T, D, O, G and S
      When Alice places C on g7 and A on h8
      Then Alice is told her tiles must lie in one line
      And the board is still empty
