@domain:games
Feature: Reviewing a puzzle's line
  When a solver has played a puzzle of the game, they want to review its whole
  line from the game log, so they can see how it goes. The review opens on the final
  position; stepping one move animates, and jumping snaps straight to the
  position. The current move is always the highlighted one.

  The puzzle here is the game's known puzzle, with two moves for the solver
  and any setup move and replies its opponent makes. The start is the
  position before the solver's first move. A puzzle without an opponent
  can be reviewed from its supplied position, before any move.

  Background:
    Given Alice is signed in
    And Alice is solving the game's known puzzle

  Rule: Review shows a played puzzle's whole line in the game log
    No counter-example: Every played puzzle retains its complete line, including retired puzzles.

    Scenario: The review opens on the final position and lists the moves as the game writes them
      Given Alice has solved the puzzle
      When Alice opens the puzzle's review from their game log
      Then Alice's review is at the end of the line, reached without animation
      And Alice's review lists the line's moves as the game writes them

    Scenario Outline: Stepping one move <way> animates
      Given Alice is reviewing the solved puzzle at <from>
      When Alice steps <way> one move in the review
      Then Alice's review is at <to>, reached with animation

      Examples:
        | way     | from                              | to                                |
        | back    | the end of the line               | the position before the last move |
        | forward | the position before the last move | the end of the line               |

    Scenario Outline: Jumping to the <edge> of the review snaps
      Given Alice is reviewing the solved puzzle at <from>
      When Alice jumps to the <edge> of the review
      Then Alice's review is at <to>, reached without animation

      Examples:
        | edge  | from                | to                  |
        | start | the end of the line | the start           |
        | end   | the start           | the end of the line |

    Scenario: Choosing a move from the list jumps to it
      Given Alice is reviewing the solved puzzle at the end of the line
      When Alice chooses the first move from the review's move list
      Then Alice's review is at the first move of the line, reached without animation

    Scenario: The review steps one move from the keyboard
      Given Alice is reviewing the solved puzzle at the end of the line
      When Alice steps back one move in the review with the keyboard
      Then Alice's review is at the position before the last move, reached with animation

    Scenario: The review jumps to the start from the keyboard
      Given Alice is reviewing the solved puzzle at the end of the line
      When Alice jumps to the start of the review with the keyboard
      Then Alice's review is at the start, reached without animation

    Scenario: A sideways flick across the board steps one move
      Given Alice is reviewing the solved puzzle at the end of the line
      When Alice flicks the review back one move
      Then Alice's review is at the position before the last move, reached with animation

    Scenario: The review after a failed attempt still covers the whole line
      Given Alice has played a wrong move and skipped the puzzle
      When Alice opens the puzzle's review from their game log
      Then Alice's review is at the end of the line, reached without animation

    Scenario: After showing the solution, the line steps back to its start in place
      Given Alice has shown the solution
      When Alice jumps to the start of the revealed line
      Then Alice's board shows the start of the puzzle within 20 seconds

    Scenario: A puzzle retired after it was played still opens in review
      Given Alice has solved the puzzle
      And the puzzle has since been retired
      When Alice opens the puzzle's review from their game log
      Then Alice's review is at the end of the line, reached without animation

  Rule: Reviewing reached positions keeps the attempt and can return to solving
    No counter-example: Looking at a reached position changes only the viewed position; wrong moves and skips require a retry before reviewing.

    Scenario: Reviewing a solved puzzle keeps its solved result
      Given Alice has solved the puzzle
      When Alice steps back one move in the puzzle
      Then Alice's puzzle remains solved
      And Alice is reviewing the position one move before the current position

    Scenario: Stepping forward to the current position allows solving to continue
      Given Alice has played the next move of the solution
      And Alice is reviewing an earlier position in the puzzle
      When Alice steps forward one move in the puzzle
      Then Alice is solving the puzzle after the first move of the solution

    Scenario: Choosing a reached move after showing the solution keeps it revealed
      Given Alice has shown the solution
      When Alice chooses the first move from the puzzle's move list
      Then Alice's board shows the first move of the line
      And Alice's puzzle remains revealed
