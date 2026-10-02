@domain:chess
Feature: Puzzle Assistant without barriers
  When a solver cannot hear or prefers less movement, they want the same
  observation and freedom to play, so the assistant never becomes a barrier.

  Rule: The assistant's observation is available without speech
    No counter-example: sound is an optional way to hear the same observation.

    Scenario: Muting keeps the current observation readable
      Given Alice is signed in
      And Alice is playing puzzles in their space
      When Alice mutes the Puzzle Assistant
      Then Alice can read the assistant's current observation
      And Alice cannot hear the assistant speaking
      And Alice can move pieces

    Scenario: Unavailable audio keeps the observation and play available
      Given Alice is signed in
      And Alice's audio is unavailable
      When Alice opens puzzles in their space
      Then Alice can read the assistant's current observation
      And Alice can move pieces

    Scenario: Reduced motion keeps the observation and play available
      Given Alice is signed in
      And Alice prefers reduced motion
      When Alice opens puzzles in their space
      Then Alice can read the assistant's current observation
      And Alice can move pieces

  Rule: Speech never hides required words or delays a move
    No counter-example: the board does not wait for speech.

    Scenario: A solver can make a move while the assistant is speaking
      Given Alice is signed in
      And Alice is solving the puzzle with more than one mate on the final move
      And Alice's assistant is speaking
      When Alice plays a7-a8
      Then Alice's puzzle is solved within 20 seconds
      And Alice's assistant acknowledges checkmate
      And Alice can read the assistant's current observation
