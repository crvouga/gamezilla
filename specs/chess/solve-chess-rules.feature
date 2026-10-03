@domain:chess
Feature: Chess rules in puzzles
  When a solver finds a correct solution, they want it to count whatever
  chess rule it uses, so a correct move is never called wrong. Every rule of
  chess is honored and every correct solution counts: underpromotion,
  capture-promotion, en passant, any mate on the final move, a faster mate,
  and a transposed move order. Promoting always asks which piece; the queen
  is never chosen for the solver. When Black solves, the board, the prompt,
  and the promotion choice follow Black.

  Rule: Every legal solution counts and the solver chooses the promotion piece

    Background:
      Given Alice is signed in

    Scenario: Promoting asks which piece instead of choosing the queen
      Given Alice is solving the underpromotion puzzle
      When Alice plays the move e7-e8
      Then Alice is asked which piece White promotes to on e8

    Scenario: Promoting to a queen is wrong when underpromotion is the solution
      Given Alice is solving the underpromotion puzzle
      When Alice plays the move e7-e8 and promotes to a queen
      Then Alice is told the move was wrong within 20 seconds

    Scenario: Underpromotion to a knight solves the puzzle
      Given Alice is solving the underpromotion puzzle
      When Alice plays the move e7-e8 and promotes to a knight
      Then Alice's puzzle is solved within 20 seconds

    Scenario: A capture-promotion that mates with a piece other than the queen solves the puzzle
      Given Alice is solving the capture-promotion puzzle
      When Alice plays the move g7-h8 and promotes to a rook
      Then Alice's puzzle is solved within 20 seconds

    Scenario: En passant counts as the solution
      Given Alice is solving the en passant puzzle
      When Alice plays the move e5-d6
      Then Alice's puzzle is solved within 20 seconds

    Scenario: A different mate on the final move solves the puzzle
      Given Alice is solving the puzzle with more than one mate on the final move
      When Alice plays the move a7-a8
      Then Alice's puzzle is solved within 20 seconds

    Scenario: A faster mate on a move before the last solves the puzzle
      Given Alice is solving the hook-mate puzzle
      When Alice plays the move b7-b8
      Then Alice's puzzle is solved within 20 seconds

    Scenario: A transposed move order solves the puzzle
      Given Alice is solving the two-rook clearance puzzle
      And Alice has played h1-h5
      When Alice plays the move a1-a5
      Then Alice's puzzle is solved within 20 seconds

    Scenario: When Black solves, the board and the prompt follow Black
      When Alice opens the puzzle Black solves by promoting
      Then Alice's board faces Black
      And it is Black's move on Alice's board
      And Alice is prompted to find the next move for Black

    Scenario: When Black solves, the promotion choice is Black's
      Given Alice is solving the puzzle Black solves by promoting
      When Alice plays the move e2-e1
      Then Alice is asked which piece Black promotes to

    Scenario: Black's promotion to a knight solves the puzzle
      Given Alice is solving the puzzle Black solves by promoting
      When Alice plays the move e2-e1 and promotes to a knight
      Then Alice's puzzle is solved within 20 seconds

    Scenario: A puzzle can start with the solver in check
      When Alice opens the puzzle that starts with White in check
      Then White is in check and to move on Alice's board

    Scenario: Escaping the opening check with the right move solves the puzzle
      Given Alice is solving the puzzle that starts with White in check
      When Alice plays the move h1-h4
      Then Alice's puzzle is solved within 20 seconds
