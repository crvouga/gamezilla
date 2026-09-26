@domain:chess @goal:chess-puzzles:5
Feature: Chess rules in puzzles
  Every rule of chess is honored and every correct solution is accepted:
  underpromotion, capture-promotion, en passant, any mate on the final move,
  a faster mate, and a transposed move order. Promoting always asks which
  piece; the queen is never chosen for the player. When Black solves, the
  board, the prompt, and the promotion choice follow Black.

  Background:
    Given Alice is signed in

  Scenario: Promoting asks which piece instead of choosing the queen
    Given Alice is solving the underpromotion puzzle
    When Alice plays e7-e8
    Then Alice is asked which piece White promotes to on e8

  Scenario: Promoting to a queen is wrong when underpromotion is the solution
    Given Alice is solving the underpromotion puzzle
    When Alice plays e7-e8 and promotes to a queen
    Then Alice is told the move was wrong within 20 seconds

  Scenario: Underpromotion to a knight solves the puzzle
    Given Alice is solving the underpromotion puzzle
    When Alice plays e7-e8 and promotes to a queen
    And Alice retries the puzzle
    And Alice plays e7-e8 and promotes to a knight
    Then Alice's puzzle is solved within 20 seconds

  Scenario: A capture-promotion that mates with a piece other than the queen is accepted
    Given Alice is solving the capture-promotion puzzle
    When Alice plays g7-h8 and promotes to a rook
    Then Alice's puzzle is solved within 20 seconds
    And the puzzle's recorded outcomes are "solved"

  Scenario: En passant is accepted as the solution
    Given Alice is solving the en passant puzzle
    When Alice plays e5-d6
    Then Alice's puzzle is solved within 20 seconds
    And the puzzle's recorded outcomes are "solved"

  Scenario: A different mate on the final move is accepted
    Given Alice is solving the puzzle with more than one mate on the final move
    When Alice plays a7-a8
    Then Alice's puzzle is solved within 20 seconds
    And the puzzle's recorded outcomes are "solved"

  Scenario: A faster mate on a move before the last ends the puzzle as solved
    Given Alice is solving the hook-mate puzzle
    When Alice plays b7-b8
    Then Alice's puzzle is solved within 20 seconds
    And the puzzle's recorded outcomes are "solved"

  Scenario: A transposing move is accepted and the line continues reordered
    Given Alice is solving the two-rook clearance puzzle
    When Alice plays h1-h5
    Then Alice is solving the puzzle at move 3 of the line
    When Alice plays a1-a5
    Then Alice's puzzle is solved within 20 seconds
    And the puzzle's recorded outcomes are "solved"

  Scenario: When Black solves, the board and the prompt follow Black
    Given Alice is solving the puzzle Black solves by promoting
    Then Alice's board faces Black
    And it is Black's move on Alice's board
    And Alice is prompted "Your turn — find the best move for Black"

  Scenario: When Black solves, the promotion choice is Black's
    Given Alice is solving the puzzle Black solves by promoting
    When Alice plays e2-e1
    Then Alice is asked which piece Black promotes to
    When Alice promotes to a knight
    Then Alice's puzzle is solved within 20 seconds
    And the puzzle's recorded outcomes are "solved"

  Scenario: A puzzle can start with the solver in check
    Given Alice is solving the puzzle that starts with White in check
    Then White is in check and to move on Alice's board
    When Alice plays h1-h4
    Then Alice's puzzle is solved within 20 seconds
    And the puzzle's recorded outcomes are "solved"
