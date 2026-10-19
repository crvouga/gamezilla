@domain:chess
Feature: Respect the app's sounds on a puzzle's capture
  When Alice chooses how the app sounds, Alice wants a chess puzzle's capture
  to follow that choice, so chess feedback never ignores silence.

  Rule: A puzzle's capture follows the app's sounds preference

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
