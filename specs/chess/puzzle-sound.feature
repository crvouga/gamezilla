@domain:chess
Feature: Respect the app's sounds while solving and reviewing
  When Alice chooses how the app sounds, Alice wants puzzles and their reviews
  to follow that choice, so chess feedback never ignores silence.

  Rule: Puzzle moves and captures follow the app's sounds preference

    @regression:merge-puzzle-move-wording
    Scenario: Enabled sounds accompany a puzzle move and its opponent reply
      Given Alice is signed in
      And Alice has turned sounds on
      And Alice is solving the two-rook clearance puzzle
      When Alice plays a1-a5
      Then Alice hears the puzzle's move sounds
      And Alice is solving the puzzle at move 3 of the line

    @regression:chess-puzzle-muted-feedback
    Scenario: Disabled sounds keep a puzzle move and its opponent reply silent
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the two-rook clearance puzzle
      When Alice plays a1-a5
      Then Alice cannot hear puzzle sounds while the app's sounds are off
      And Alice is solving the puzzle at move 3 of the line

    @regression:chess-puzzle-duplicate-rating-feedback
    Scenario: Enabled sounds accompany the puzzle's capture
      Given Alice is signed in
      And Alice has turned sounds on
      And Alice is solving the en passant puzzle
      When Alice plays e5-d6
      Then Alice hears the puzzle's capture sound
      And Alice's puzzle is solved within 20 seconds

    @regression:chess-puzzle-rating-feedback-late
    Scenario: A resumed puzzle completes its capture feedback after sounds are enabled
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the en passant puzzle
      And Alice has since turned sounds on and returned to that unfinished puzzle
      When Alice plays e5-d6
      Then Alice hears the puzzle's capture sound
      And Alice's puzzle is solved within 20 seconds

    @regression:chess-puzzle-muted-feedback
    Scenario: Disabled sounds keep the puzzle's capture silent
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the en passant puzzle
      When Alice plays e5-d6
      Then Alice cannot hear puzzle sounds while the app's sounds are off
      And Alice's puzzle is solved within 20 seconds

    Scenario: Enabled sounds accompany a wrong puzzle move
      Given Alice is signed in
      And Alice has turned sounds on
      And Alice is solving the castling puzzle
      When Alice plays a wrong move
      Then Alice is told the move was wrong
      And Alice hears the puzzle's wrong-move feedback

    @regression:chess-puzzle-muted-feedback
    Scenario: Disabled sounds keep wrong-move feedback silent
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the castling puzzle
      When Alice plays a wrong move
      Then Alice is told the move was wrong
      And Alice cannot hear puzzle sounds while the app's sounds are off

  Rule: Sound changes preserve the puzzle and apply to its next move

    Scenario: Turning sounds off preserves the unfinished puzzle
      Given Alice is signed in
      And Alice has turned sounds on
      And Alice is solving the two-rook clearance puzzle
      When Alice turns sounds off
      Then Alice's sounds are off
      And Alice is solving the puzzle at move 1 of the line

    Scenario: A puzzle already open follows a later silence choice
      Given Alice is signed in
      And Alice is solving the two-rook clearance puzzle
      And Alice has since turned sounds off and returned to that unfinished puzzle
      When Alice plays a1-a5
      Then Alice cannot hear puzzle sounds while the app's sounds are off
      And Alice is solving the puzzle at move 3 of the line

    Scenario: Turning sounds on preserves the unfinished puzzle
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the two-rook clearance puzzle
      When Alice turns sounds on
      Then Alice's sounds are on
      And Alice is solving the puzzle at move 1 of the line

    @regression:chess-puzzle-replayed-feedback
    Scenario: Enabling sounds preserves the reached opening without repeating its setup sound
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the en passant puzzle
      When Alice turns sounds on
      Then Alice hears no new puzzle feedback
      And Alice is solving the puzzle at move 1 of the line

    @regression:chess-puzzle-replayed-feedback
    Scenario: Enabling sounds after a silent solve does not repeat solved feedback
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice has solved the en passant puzzle
      When Alice turns sounds on
      Then Alice hears no new puzzle feedback
      And Alice's puzzle is solved

  Rule: A review's forward move follows the same app sounds preference

    Scenario: An enabled review sounds its next move
      Given Alice is signed in
      And Alice has turned sounds on
      And Alice is reviewing the solved puzzle at move 3
      When Alice steps forward one move in the review
      Then Alice hears the review's move sound
      And Alice's review is at move 4 of 4, reached with animation

    Scenario: A muted review remains silent while its position changes
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is reviewing the solved puzzle at move 3
      When Alice steps forward one move in the review
      Then Alice cannot hear puzzle sounds while the app's sounds are off
      And Alice's review is at move 4 of 4, reached with animation
