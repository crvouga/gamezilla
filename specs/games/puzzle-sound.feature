@domain:games
Feature: Respect the app's sounds while solving and reviewing
  When Alice chooses how the app sounds, Alice wants the game's puzzles and
  their reviews to follow that choice, so puzzle feedback never ignores
  silence.

  Rule: Puzzle moves follow the app's sounds preference

    @regression:merge-puzzle-move-wording
    Scenario: Enabled sounds accompany a correct puzzle continuation
      Given Alice is signed in
      And Alice has turned sounds on
      And Alice is solving the game's known puzzle
      When Alice plays the next move of the solution
      Then Alice hears the puzzle's move sounds
      And Alice is solving the puzzle after the first move of the solution

    @regression:chess-puzzle-muted-feedback
    Scenario: Disabled sounds keep a correct puzzle continuation silent
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the game's known puzzle
      When Alice plays the next move of the solution
      Then Alice cannot hear puzzle sounds while the app's sounds are off
      And Alice is solving the puzzle after the first move of the solution

    Scenario: Enabled sounds accompany a wrong puzzle move
      Given Alice is signed in
      And Alice has turned sounds on
      And Alice is solving the game's known puzzle
      When Alice plays a wrong move
      Then Alice is told the move was wrong
      And Alice hears the puzzle's wrong-move feedback

    @regression:chess-puzzle-muted-feedback
    Scenario: Disabled sounds keep wrong-move feedback silent
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the game's known puzzle
      When Alice plays a wrong move
      Then Alice is told the move was wrong
      And Alice cannot hear puzzle sounds while the app's sounds are off

  Rule: Sound changes preserve the puzzle and apply to its next move
    No counter-example: Sound changes always preserve puzzle progress and never repeat feedback that is over.

    Scenario: Turning sounds off preserves the unfinished puzzle
      Given Alice is signed in
      And Alice has turned sounds on
      And Alice is solving the game's known puzzle
      When Alice turns sounds off
      Then Alice's sounds are off
      And Alice is solving the puzzle before the first move of the solution

    Scenario: A puzzle already open follows a later silence choice
      Given Alice is signed in
      And Alice is solving the game's known puzzle
      And Alice has since turned sounds off and returned to that unfinished puzzle
      When Alice plays the next move of the solution
      Then Alice cannot hear puzzle sounds while the app's sounds are off
      And Alice is solving the puzzle after the first move of the solution

    Scenario: Turning sounds on preserves the unfinished puzzle
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the game's known puzzle
      When Alice turns sounds on
      Then Alice's sounds are on
      And Alice is solving the puzzle before the first move of the solution

    @regression:chess-puzzle-replayed-feedback
    Scenario: Enabling sounds keeps the puzzle at its start without repeating earlier feedback
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the game's known puzzle
      When Alice turns sounds on
      Then Alice hears no new puzzle feedback
      And Alice is solving the puzzle before the first move of the solution

    @regression:chess-puzzle-replayed-feedback
    Scenario: Enabling sounds after a silent solve does not repeat solved feedback
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice has solved the game's known puzzle
      When Alice turns sounds on
      Then Alice hears no new puzzle feedback
      And Alice's puzzle is solved

  Rule: A review's forward move follows the same app sounds preference

    Scenario: An enabled review sounds its next move
      Given Alice is signed in
      And Alice has turned sounds on
      And Alice is reviewing the solved puzzle at the position before the last move
      When Alice steps forward one move in the review
      Then Alice hears the review's move sound
      And Alice's review is at the end of the line, reached with animation

    Scenario: A muted review remains silent while its position changes
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is reviewing the solved puzzle at the position before the last move
      When Alice steps forward one move in the review
      Then Alice cannot hear puzzle sounds while the app's sounds are off
      And Alice's review is at the end of the line, reached with animation
