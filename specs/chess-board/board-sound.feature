@domain:chess-board
Feature: Respect the activity's chessboard sound choice
  When a chessboard is embedded in an activity, Alice wants its sound choice
  respected, so silence and sound never depend on an unfinished animation.

  Rule: Disabled sound prevents every chessboard sound

    Scenario: An enabled move sounds once
      Given Alice has an interactive chessboard
      When Alice moves the piece from e2 to e4
      Then Alice hears one move sound

    @regression:chessboard-sound-authority
    Scenario: A silent chessboard stays silent through a move
      Given Alice has a silent chessboard
      When Alice moves the piece from e2 to e4
      Then Alice hears no chessboard sounds
      And Alice sees a White pawn on e4

    Scenario: A silent capture stays silent
      Given Alice has a silent chessboard ready for a capture
      When Alice moves the piece from e4 to d5
      Then Alice hears no chessboard sounds
      And Alice sees a White pawn on d5

  Rule: Changing sound cancels delayed feedback without replaying it

    Scenario: Enabling sound allows the next move
      Given Alice has a silent chessboard
      And Alice's board settings enable sound
      When Alice moves the piece from e2 to e4
      Then Alice hears one move sound

    Scenario: Disabling sound during a capture prevents its delayed sound
      Given Alice's capture from e4 to d5 is animating
      When Alice's board settings disable sound
      Then Alice hears no chessboard sounds
      And Alice sees a White pawn on d5

    @regression:chessboard-stale-sound
    Scenario: A replaced position prevents the old capture sound
      Given Alice's capture from e4 to d5 is animating
      When Alice's activity replaces the position
      Then Alice hears no chessboard sounds
      And Alice sees the replacement position

    Scenario: Closing the chessboard prevents its delayed sound
      Given Alice's capture from e4 to d5 is animating
      When Alice closes the chessboard
      Then Alice hears no chessboard sounds
