@domain:chess
Feature: Chess truth decides a solution
  When a solver finds checkmate, they want it accepted whatever the preferred
  line, so every legal checkmate has the same successful outcome. Winning a
  puzzle another way, offline too, is a rule of every game offering puzzles.

  Rule: Any legal checkmate solves the puzzle immediately

    Scenario Outline: Either rook delivers a valid checkmate
      Given Alice is signed in
      And Alice is solving the puzzle with more than one mate on the final move
      When Alice plays the move <move>
      Then Alice's puzzle is solved within 20 seconds
      And Alice's game log records that puzzle as solved
      And Alice's stats show 1 played, 1 solved, and 100% accuracy

      Examples:
        | move  |
        | a7-a8 |
        | b7-b8 |

    Scenario: A legal move that neither solves nor checkmates is wrong
      Given Alice is signed in
      And Alice is solving the puzzle with more than one mate on the final move
      When Alice plays the move a7-a6
      Then Alice is told the move was wrong

    Scenario: An illegal apparent checkmate cannot solve the puzzle
      Given Alice is signed in
      And Alice is solving the two-rook clearance puzzle
      When Alice tries the illegal move a1-a8
      Then Alice's board is unchanged
      And Alice is still asked to find the next move
