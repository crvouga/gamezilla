@domain:chess
Feature: Multiplayer chess leaves the space's puzzles alone
  When a person finds a chess opponent from a space playing puzzles, they want the space's puzzle and their puzzle rating left as they were, so multiplayer chess never disturbs their puzzles.

  Rule: Multiplayer chess is separate from puzzles in a space
    No counter-example: nothing a person does in multiplayer chess reaches the space's puzzle or their puzzle rating, so there is nothing to refuse.

    Scenario: Returning after looking for an opponent keeps the space's puzzle as it was
      Given Alice and Bob are playing a puzzle in a space
      And Alice has found a chess opponent for 5+0
      When Alice returns to the puzzle in the space
      Then Bob keeps the same puzzle in the space

    Scenario: A multiplayer result does not move a puzzle rating
      Given Alice's puzzle rating has settled at 1700
      And Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      When Alice resigns multiplayer chess
      Then Alice's puzzle rating is 1700
