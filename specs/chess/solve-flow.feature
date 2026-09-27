@domain:chess @goal:chess-puzzles:8 @goal:chess-puzzles:9 @goal:chess-puzzles:10
Feature: The solve flow
  A puzzle opens with the opponent's setup move already played and the board
  facing the solver, who is prompted to move. Each correct move is answered
  by the opponent's reply, played by itself. Finishing the line solves the
  puzzle, and a wrong move is called out at once.

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

  Scenario: Finishing the line solves the puzzle
    Given Alice is signed in
    And Alice is solving the two-rook clearance puzzle
    When Alice plays a1-a5
    And Alice plays h1-h5
    Then Alice's puzzle is solved within 20 seconds
    And Alice feels the success haptic

  Scenario: A wrong move is called out at once
    Given Alice is signed in
    And Alice is solving the castling puzzle
    When Alice plays a wrong move
    Then Alice is told the move was wrong
    And Alice feels the error haptic

  Scenario Outline: Castling by moving the king <gesture> solves the castling puzzle
    Given Alice is signed in
    And Alice is solving the castling puzzle
    When Alice castles by moving the king <gesture>
    Then Alice's puzzle is solved within 20 seconds

    Examples:
      | gesture           |
      | two squares       |
      | onto its own rook |
