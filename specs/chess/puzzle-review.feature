@domain:chess @goal:chess-puzzles:7
Feature: Reviewing a puzzle's line
  After a puzzle, the player can review its whole line from the game log.
  The review opens on the final position; stepping one move animates, and
  jumping snaps straight to the position. The current move is always the
  highlighted one.

  The puzzle here is a mate in two whose line is four moves long: Kh4 g5+
  Kg3 Rg2#. Move 1 is the position after the opponent's setup move, and
  "the review is at move N" means the board shows the position after move N
  of the line with move N highlighted.

  Background:
    Given Alice is signed in
    And Alice is solving the four-move mate-in-two puzzle

  Scenario: The review opens on the final position and lists the moves in algebraic notation
    When Alice solves the puzzle
    And Alice opens the puzzle's review from their game log
    Then Alice's review is at move 4 of 4, reached without animation
    And Alice's review lists the moves "Kh4, g5+, Kg3, Rg2#"

  Scenario: Stepping back and forward one move animates
    Given Alice has solved the puzzle and is reviewing it
    When Alice steps back one move in the review
    Then Alice's review is at move 3 of 4, reached with animation
    When Alice steps forward one move in the review
    Then Alice's review is at move 4 of 4, reached with animation

  Scenario: Jumping to the start and the end snaps
    Given Alice has solved the puzzle and is reviewing it
    When Alice jumps to the start of the review
    Then Alice's review is at move 1 of 4, reached without animation
    When Alice jumps to the end of the review
    Then Alice's review is at move 4 of 4, reached without animation

  Scenario: Choosing a move from the list jumps to it, and stepping from there animates
    Given Alice has solved the puzzle and is reviewing it
    When Alice chooses move 2 from the review's move list
    Then Alice's review is at move 2 of 4, reached without animation
    When Alice steps back one move in the review
    Then Alice's review is at move 1 of 4, reached with animation

  Scenario: The left and right arrow keys step one move
    Given Alice has solved the puzzle and is reviewing it
    When Alice steps back one move in the review with the keyboard
    Then Alice's review is at move 3 of 4, reached with animation
    When Alice steps forward one move in the review with the keyboard
    Then Alice's review is at move 4 of 4, reached with animation

  Scenario: The Home and End keys jump to the start and the end
    Given Alice has solved the puzzle and is reviewing it
    When Alice jumps to the start of the review with the keyboard
    Then Alice's review is at move 1 of 4, reached without animation
    When Alice jumps to the end of the review with the keyboard
    Then Alice's review is at move 4 of 4, reached without animation

  Scenario: A sideways flick across the board steps one move at a time
    Given Alice has solved the puzzle and is reviewing it
    When Alice flicks the review back one move
    Then Alice's review is at move 3 of 4, reached with animation
    When Alice flicks the review forward one move
    Then Alice's review is at move 4 of 4, reached with animation

  Scenario: The review after a failed attempt still covers the whole line
    When Alice plays a wrong move
    And Alice skips the puzzle
    And Alice opens the puzzle's review from their game log
    Then Alice's review is at move 4 of 4, reached without animation
    When Alice jumps to the start of the review
    Then Alice's review is at move 1 of 4, reached without animation

  Scenario: After showing the solution, the whole line can be stepped through in place
    When Alice shows the solution
    Then Alice's puzzle shows the revealed solution within 20 seconds
    When Alice jumps to the start of the revealed line
    Then Alice's board is at move 1 of the line within 20 seconds
    When Alice jumps to the end of the revealed line
    Then Alice's board is at move 4 of the line within 20 seconds

  Scenario: A retired puzzle still opens in review from the game log
    When Alice solves the puzzle
    And Alice loses the connection
    And the puzzle is retired from the pool
    And the connection comes back
    Then Alice's device knows the puzzle is retired within 20 seconds
    When Alice opens the puzzle's review from their game log
    Then Alice's review is at move 4 of 4, reached without animation
    When Alice jumps to the start of the review
    Then Alice's review is at move 1 of 4, reached without animation
