@domain:games
Feature: Matched games and custom games leave the game's puzzles alone
  When a person in a space playing puzzles of the game finds an opponent, or
  plays a matched game or a custom game, they want the space's puzzle and
  their puzzle rating left as they were, so other play never disturbs their
  puzzles. It holds for every game that offers puzzles as well as finding an
  opponent or custom games.

  Rule: Finding an opponent leaves the space's puzzle as it was
    No counter-example: nothing a person does while finding an opponent reaches the space's puzzle, so there is nothing to refuse.

    Scenario: Returning after being paired up keeps the space's puzzle as it was
      Given Alice and Bob are playing a puzzle in a space
      And Alice has been paired up with an opponent for the game at 5+0
      When Alice returns to the puzzle in the space
      Then Bob keeps the same puzzle in the space

  Rule: A matched game's result never moves a puzzle rating
    No counter-example: nothing played in a matched game reaches a puzzle rating, so there is nothing to refuse.

    Scenario: Resigning a matched game leaves the puzzle rating as it was
      Given Alice's puzzle rating has settled at 1700
      And Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Alice resigns the matched game
      Then Alice's puzzle rating is 1700

  Rule: A custom game never changes a puzzle rating
    No counter-example: nothing played in a custom game reaches a puzzle rating.

    Scenario: A custom game cannot change the puzzle rating
      Given Alice and Bob have a custom game under way
      When Alice resigns the custom game
      Then Bob wins the custom game by resignation
      And Alice's puzzle rating is 1500
