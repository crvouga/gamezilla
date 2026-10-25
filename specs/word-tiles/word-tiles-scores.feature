@domain:word-tiles
Feature: Score words
  When Alice places a word, she wants it scored by its tiles and bonus squares, so better placements earn more points.

  Rule: Bonus squares count only under the tiles a placement adds
    No counter-example: every placement is scored the same way, and no placement can use a bonus square twice.

    Scenario: A first word doubles on the centre square
      Given Alice and Bob have started Word Tiles with Alice holding C, A, T, D, O, G and S
      When Alice places CAT from g8 to i8
      Then Alice scores 10 points

    Scenario: A bonus square under a tile already on the board counts no more
      Given CAT is on the board from g8 to i8 with Alice holding S, S, E, D, O, G and R
      When Alice places SCATS from f8 to j8
      Then Alice scores 11 points

  Rule: A placement scores every word it forms, each once
    No counter-example: a placement always scores each word it forms or extends.

    Scenario: One tile forming two words scores both
      Given CAT is on the board from g8 to i8 and TO from i8 to i9 with Alice holding S, E, D, O, G, R and A
      When Alice places S on h9
      Then Alice scores 4 points for AS and SO

  Rule: A blank plays the letter its player chooses and scores no points
    No counter-example: a blank always plays the letter its player chooses.

    Scenario: A blank played as A scores nothing while its word still doubles
      Given Alice and Bob have started Word Tiles with Alice holding C, a blank, T, D, O, G and S
      When Alice places CAT from g8 to i8 with the blank as A
      Then Alice scores 8 points
      And the board shows the blank as A on h8

  Rule: Placing all seven tiles earns the seven-tile bonus
    No counter-example: every placement of seven tiles earns it; fewer tiles score only their words.

    Scenario: Placing all seven tiles earns 50 points more
      Given Alice and Bob have started Word Tiles with Alice holding R, E, T, A, I, N and S
      When Alice places RETAINS from d8 to j8
      Then Alice scores 72 points
