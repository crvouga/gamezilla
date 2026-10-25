@domain:word-tiles
Feature: End a game of Word Tiles
  When the tiles run out or nobody scores, the players want the game to end with every rack counted, so the highest score wins fairly.

  Rule: A player who goes out ends the game and gains the others' tiles

    Scenario: Going out ends the game and takes the points of Bob's tiles
      Given Alice has 10 points and holds A and T, Bob has 30 points and holds Q and Z, the bag is empty and C is on the board on h7
      When Alice places AT from h8 to h9
      Then the game is over
      And Alice has 40 points and Bob has 10 points
      And Alice wins

    Scenario: Nobody takes a turn once the game is over
      Given Alice has gone out and the game is over
      When Bob passes
      Then Bob is told the game is over

  Rule: Six scoreless turns in a row end the game
    No counter-example: the sixth scoreless turn in a row always ends the game.

    Scenario: The sixth pass in a row ends the game and every rack counts against its player
      Given Alice and Bob have passed five turns in a row with Alice holding Q, Z, A, A, A, A and A and Bob holding seven E tiles
      When Alice passes
      Then the game is over
      And Alice has -25 points and Bob has -7 points
      And Bob wins

    Scenario: A placement that scores starts the count of scoreless turns again
      Given Alice and Bob have passed five turns in a row with Alice holding C, A, T, D, O, G and S
      When Alice places CAT from g8 to i8
      Then Bob has the turn
      And the game has no scoreless turns in a row

  Rule: Players tied for the highest score share the win
    No counter-example: every tie for the highest score is shared.

    Scenario: Equal scores at the end share the win
      Given Alice and Bob have passed five turns in a row with Alice holding seven E tiles and Bob holding seven A tiles
      When Alice passes
      Then Alice and Bob share the win
