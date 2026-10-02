@domain:chess
Feature: Respect the app's sounds while solving and reviewing
  When Alice chooses how the app sounds, Alice wants puzzles and their reviews
  to follow that choice, so chess feedback never ignores silence.

  Rule: Puzzle moves and captures follow the app's sounds preference

    Scenario: Enabled sounds accompany a puzzle move and its opponent reply
      Given Alice is signed in
      And Alice has turned sounds on
      And Alice is solving the two-rook clearance puzzle
      When Alice plays a1-a5
      Then Alice hears the puzzle's move sounds
      And Alice is solving the puzzle at move 3 of the line

    Scenario: Disabled sounds keep a puzzle move and its opponent reply silent
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the two-rook clearance puzzle
      When Alice plays a1-a5
      Then Alice cannot hear puzzle board sounds while the app's sounds are off
      And Alice is solving the puzzle at move 3 of the line

    Scenario: Enabled sounds accompany the puzzle's capture
      Given Alice is signed in
      And Alice has turned sounds on
      And Alice is solving the en passant puzzle
      When Alice plays e5-d6
      Then Alice hears the puzzle's capture sound
      And Alice's puzzle is solved within 20 seconds

    Scenario: Disabled sounds keep the puzzle's capture silent
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the en passant puzzle
      When Alice plays e5-d6
      Then Alice cannot hear puzzle board sounds while the app's sounds are off
      And Alice's puzzle is solved within 20 seconds

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
      Then Alice cannot hear puzzle board sounds while the app's sounds are off
      And Alice is solving the puzzle at move 3 of the line

    Scenario: Turning sounds on preserves the unfinished puzzle
      Given Alice is signed in
      And Alice has turned sounds off
      And Alice is solving the two-rook clearance puzzle
      When Alice turns sounds on
      Then Alice's sounds are on
      And Alice is solving the puzzle at move 1 of the line

  Rule: A review's forward move follows the same app sounds preference

    Scenario: An enabled review sounds its next move
      Given Alice has turned sounds on
      And Alice is reviewing the solved puzzle at move 3
      When Alice steps forward one move in the review
      Then Alice hears the review's move sound
      And Alice's review is at move 4 of 4, reached with animation

    Scenario: A muted review remains silent while its position changes
      Given Alice has turned sounds off
      And Alice is reviewing the solved puzzle at move 3
      When Alice steps forward one move in the review
      Then Alice cannot hear puzzle board sounds while the app's sounds are off
      And Alice's review is at move 4 of 4, reached with animation
