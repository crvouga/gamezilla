@domain:chess @goal:chess-puzzles:11
Feature: Reviewing a puzzle's line
  When a solver has played a puzzle, they want to review its whole line from
  the game log, so they can see how it goes. The review opens on the final
  position; stepping one move animates, and jumping snaps straight to the
  position. The current move is always the highlighted one.

  The puzzle here is a mate in two whose line is four moves long: Kh4 g5+
  Kg3 Rg2#. Move 1 is the position after the opponent's setup move, and
  "the review is at move N" means the board shows the position after move N
  of the line with move N highlighted.

  Background:
    Given Alice is signed in
    And Alice is solving the four-move mate-in-two puzzle

  Scenario: The review opens on the final position and lists the moves in algebraic notation
    Given Alice has solved the puzzle
    When Alice opens the puzzle's review from their game log
    Then Alice's review is at move 4 of 4, reached without animation
    And Alice's review lists the moves "Kh4, g5+, Kg3, Rg2#"

  Scenario Outline: Stepping one move <way> animates
    Given Alice is reviewing the solved puzzle at move <from>
    When Alice steps <way> one move in the review
    Then Alice's review is at move <to> of 4, reached with animation

    Examples:
      | way     | from | to |
      | back    | 4    | 3  |
      | forward | 3    | 4  |

  Scenario Outline: Jumping to the <edge> of the review snaps
    Given Alice is reviewing the solved puzzle at move <from>
    When Alice jumps to the <edge> of the review
    Then Alice's review is at move <to> of 4, reached without animation

    Examples:
      | edge  | from | to |
      | start | 4    | 1  |
      | end   | 1    | 4  |

  Scenario: Choosing a move from the list jumps to it
    Given Alice is reviewing the solved puzzle at move 4
    When Alice chooses move 2 from the review's move list
    Then Alice's review is at move 2 of 4, reached without animation

  Scenario: The review steps one move from the keyboard
    Given Alice is reviewing the solved puzzle at move 4
    When Alice steps back one move in the review with the keyboard
    Then Alice's review is at move 3 of 4, reached with animation

  Scenario: The review jumps to the start from the keyboard
    Given Alice is reviewing the solved puzzle at move 4
    When Alice jumps to the start of the review with the keyboard
    Then Alice's review is at move 1 of 4, reached without animation

  Scenario: A sideways flick across the board steps one move
    Given Alice is reviewing the solved puzzle at move 4
    When Alice flicks the review back one move
    Then Alice's review is at move 3 of 4, reached with animation

  Scenario: The review after a failed attempt still covers the whole line
    Given Alice has played a wrong move and skipped the puzzle
    When Alice opens the puzzle's review from their game log
    Then Alice's review is at move 4 of 4, reached without animation

  Scenario: After showing the solution, the line steps back to its start in place
    Given Alice has shown the solution
    When Alice jumps to the start of the revealed line
    Then Alice's board is at move 1 of the line within 20 seconds

  Scenario: A puzzle retired after it was played still opens in review
    Given Alice has solved the puzzle
    And the puzzle has since been retired
    When Alice opens the puzzle's review from their game log
    Then Alice's review is at move 4 of 4, reached without animation
