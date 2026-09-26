@domain:chess @goal:chess-puzzles:5
Feature: The solve flow
  A puzzle opens with the opponent's setup move already played and the board
  facing the solver, who is prompted to move. Each correct move is answered
  by the opponent's reply, played by itself. Finishing the line records one
  solved outcome. The first wrong move is the attempt's outcome: nothing
  after it, not a retry, a solve, or showing the solution, rates it again.

  Scenario: The puzzle opens after the opponent's setup move, facing the solver
    Given Alice is signed in
    And Alice is solving the two-rook clearance puzzle
    Then Alice's board faces White
    And Alice's board shows a7-a6 as the last move
    And it is White's move on Alice's board
    And Alice is prompted "Your turn — find the best move for White"

  Scenario: A correct move is answered by the opponent's reply, played by itself
    Given Alice is signed in
    And Alice is solving the two-rook clearance puzzle
    When Alice plays a1-a5
    Then the opponent replies h7-h6 by itself
    And it is White's move on Alice's board
    And Alice is solving the puzzle at move 3 of the line

  Scenario: Finishing the line records exactly one solved outcome
    Given Alice is signed in
    And Alice is solving the two-rook clearance puzzle
    When Alice plays a1-a5
    And Alice plays h1-h5
    Then Alice's puzzle is solved within 20 seconds
    And the puzzle's recorded outcomes are "solved"
    And Alice feels the success haptic

  Scenario: The first wrong move fails the attempt
    Given Alice is signed in
    And Alice is solving the castling puzzle
    When Alice plays a wrong move
    Then Alice is told the move was wrong
    And the puzzle's recorded outcomes are "failed"
    And Alice feels the error haptic

  Scenario: Showing the solution after a wrong move rates nothing again
    Given Alice is signed in
    And Alice is solving the castling puzzle
    When Alice plays a wrong move
    And Alice shows the solution
    Then the puzzle's recorded outcomes are "failed"

  Scenario: Solving on a retry by moving the king onto its own rook rates nothing again
    Given Alice is signed in
    And Alice is solving the castling puzzle
    When Alice plays a wrong move
    And Alice retries the puzzle
    And Alice castles by moving the king onto its own rook
    Then Alice's puzzle is solved within 20 seconds
    And the puzzle's recorded outcomes are "failed"

  Scenario: Solving on a retry by moving the king two squares rates nothing again
    Given Alice is signed in
    And Alice is solving the castling puzzle
    When Alice plays a wrong move
    And Alice retries the puzzle
    And Alice castles by moving the king two squares
    Then Alice's puzzle is solved within 20 seconds
    And the puzzle's recorded outcomes are "failed"
