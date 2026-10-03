@domain:chess
Feature: The solve flow
  When a solver opens a puzzle, they want to know at once whose move it is
  and whether each move was right, so solving feels like playing. A puzzle
  opens with the opponent's setup move already played and the board facing
  the solver, who is prompted to move. Each correct move is answered by the
  opponent's reply, played by itself. Finishing the line solves the puzzle,
  and a wrong move is called out at once and stays the attempt's outcome,
  however the puzzle is solved afterwards.

  Rule: The board follows the solution and tells the solver when a move is wrong

    Scenario: The puzzle opens after the opponent's setup move, facing the solver
      Given Alice is signed in
      When Alice opens the two-rook clearance puzzle
      Then Alice's board faces White
      And Alice's board shows a7-a6 as the last move
      And it is White's move on Alice's board
      And Alice is prompted to find the next move for White

    Scenario: A correct move is answered by the opponent's reply, played by itself
      Given Alice is signed in
      And Alice is solving the two-rook clearance puzzle
      When Alice plays the move a1-a5
      Then the opponent replies h7-h6 by itself
      And it is White's move on Alice's board
      And Alice is solving the puzzle at move 3 of the line

    Scenario: Finishing the line solves the puzzle
      Given Alice is signed in
      And Alice is solving the two-rook clearance puzzle
      And Alice has played a1-a5
      When Alice plays the move h1-h5
      Then Alice's puzzle is solved within 20 seconds
      And Alice feels the success haptic

    Scenario: A wrong move is called out at once
      Given Alice is signed in
      And Alice is solving the castling puzzle
      When Alice plays a wrong move
      Then Alice is told the move was wrong
      And Alice feels the error haptic

    Scenario: Castling by moving the king two squares solves the puzzle
      Given Alice is signed in
      And Alice is solving the castling puzzle
      When Alice castles by moving the king two squares
      Then Alice's puzzle is solved within 20 seconds

    Scenario: Castling by moving the king onto its rook solves the puzzle
      Given Alice is signed in
      And Alice is solving the castling puzzle
      When Alice castles by moving the king onto its own rook
      Then Alice's puzzle is solved within 20 seconds

    Scenario: Retrying and castling two squares keeps the failed result
      Given Alice is signed in
      And Alice is solving the castling puzzle
      And Alice has played a wrong move and retried
      When Alice castles by moving the king two squares
      Then Alice's puzzle is solved within 20 seconds
      And Alice's game log records that puzzle as failed
      And Alice's stats show 1 played, 0 solved, and 0% accuracy

    Scenario: Retrying and castling onto the rook keeps the failed result
      Given Alice is signed in
      And Alice is solving the castling puzzle
      And Alice has played a wrong move and retried
      When Alice castles by moving the king onto its own rook
      Then Alice's puzzle is solved within 20 seconds
      And Alice's game log records that puzzle as failed
      And Alice's stats show 1 played, 0 solved, and 0% accuracy
