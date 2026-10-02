@domain:chess
Feature: Commentary follows the current puzzle
  When a solver moves quickly or steps away, they want commentary about the
  current board, so an old observation can never describe a new position.

  Rule: Replacing the position replaces its commentary and interrupts its speech

    Scenario: Retrying removes the wrong-move diagnosis
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has played a wrong move
      When Alice retries the puzzle
      Then Alice's assistant encourages another look at the current position
      And Alice's assistant cannot present the old wrong-move diagnosis

    Scenario: Moving on removes the old puzzle's success commentary
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has solved the puzzle
      When Alice moves on to the next puzzle
      Then Alice's assistant introduces the current puzzle
      And Alice's assistant cannot present the old success commentary

    Scenario: Leaving the puzzle stops its speech
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice's assistant is speaking
      When Alice leaves the puzzle for the chess choices
      Then Alice cannot hear the old puzzle's assistant speaking

    Scenario: Returning keeps commentary about the current board
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice is offline
      And Alice has solved the puzzle
      When the connection comes back
      Then Alice's assistant acknowledges the current solved puzzle
      And Alice's assistant cannot call the move wrong
