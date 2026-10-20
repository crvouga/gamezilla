@domain:chess
Feature: Commentary follows the current puzzle
  When a solver moves quickly or steps away, they want commentary about the
  current board, so an old observation can never describe a new position.

  Rule: Replacing the position replaces its commentary and interrupts its speech
    No counter-example: Changing the position always replaces the observation; it has no optional refusal.

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

  Rule: Commentary belongs to the position being examined

    Scenario: An earlier position receives review guidance
      Given Alice is signed in
      And Alice is solving the two-rook clearance puzzle
      And Alice has shown the solution
      When Alice steps back one move in the puzzle
      Then Alice's assistant explains that they are reviewing an earlier position
      And Alice's assistant cannot diagnose a move from another position

    Scenario: Returning to the current move restores current guidance
      Given Alice is signed in
      And Alice is solving the two-rook clearance puzzle
      And Alice has shown the solution
      And Alice is reviewing an earlier position in the puzzle
      When Alice returns to the current puzzle move
      Then Alice's assistant explains that the solution is shown

    @regression:puzzle-solved-review-forward
    Scenario: Returning to the solved position restores checkmate guidance
      Given Alice is signed in
      And Alice is solving the puzzle with more than one mate on the final move
      And Alice has solved the puzzle
      And Alice is reviewing an earlier position in the puzzle
      When Alice returns to the current puzzle move
      Then Alice's assistant acknowledges checkmate
      And Alice's assistant cannot call the move wrong

  Rule: An opponent reply cannot be described as the solver needing to escape check
    No counter-example: the assistant identifies whose turn the displayed position represents.

    Scenario: A correct intermediate move receives encouragement
      Given Alice is signed in
      And Alice is solving the two-rook clearance puzzle
      When Alice plays the move a1-a5
      Then Alice's assistant acknowledges a correct continuation
      And Alice's assistant cannot diagnose a move from another position

    Scenario: Retrying a wrong continuation retains the correct moves already played
      Given Alice is signed in
      And Alice is solving the four-move mate-in-two puzzle
      And Alice has played g6-g5
      And Alice has played a wrong move
      When Alice retries the puzzle
      Then Alice's board is at move 3 of the line within 20 seconds
      And Alice's assistant acknowledges a correct continuation

  Rule: Position review preserves completed play and can return to unfinished play
    No counter-example: Reviewing changes the viewed position, never the attempt's result.

    Scenario: Stepping back after checkmate retains the solved result
      Given Alice is signed in
      And Alice is solving the puzzle with more than one mate on the final move
      And Alice has solved the puzzle
      When Alice steps back one move in the puzzle
      Then Alice's puzzle remains solved
      And Alice's assistant explains that they are reviewing an earlier position

    Scenario: Stepping forward to the current position restores continuation guidance
      Given Alice is signed in
      And Alice is solving the four-move mate-in-two puzzle
      And Alice has played g6-g5
      And Alice is reviewing an earlier position in the puzzle
      When Alice steps forward one move in the puzzle
      Then Alice's board is at move 3 of the line within 20 seconds
      And Alice's assistant acknowledges a correct continuation
