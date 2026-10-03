@domain:chess
Feature: Puzzle actions respect the position and result
  When a solver has finished a puzzle or examines an earlier position,
  they want unavailable actions to change nothing, so progress and guidance
  always describe the position they are actually solving.

  Background:
    Given Alice is signed in
    And Alice is solving the four-move mate-in-two puzzle

  Rule: A finished puzzle refuses new moves, hints and skips
    No counter-example: These actions never replace a finished result; retry and review have their own rules.

    Scenario Outline: A further move cannot change a finished puzzle
      Given Alice has finished this puzzle by <finish>
      When Alice tries another move after finishing
      Then Alice's action is refused because the puzzle is over
      And Alice's puzzle remains <state>
      And Alice's game log records that puzzle as <outcome>

      Examples:
        | finish               | state    | outcome   |
        | solving it cleanly   | solved   | solved    |
        | showing the solution | revealed | failed    |
        | skipping it          | skipped  | abandoned |

    Scenario Outline: A hint cannot change a finished puzzle
      Given Alice has finished this puzzle by <finish>
      When Alice tries to take a hint after finishing
      Then Alice's action is refused because the puzzle is over
      And Alice's puzzle remains <state>

      Examples:
        | finish               | state    |
        | solving it cleanly   | solved   |
        | showing the solution | revealed |
        | skipping it          | skipped  |

    Scenario Outline: Skipping cannot replace a finished result
      Given Alice has finished this puzzle by <finish>
      When Alice tries to skip after finishing
      Then Alice's action is refused because the puzzle is over
      And Alice's game log records that puzzle as <outcome>

      Examples:
        | finish               | outcome   |
        | solving it cleanly   | solved    |
        | showing the solution | failed    |
        | skipping it          | abandoned |

    Scenario Outline: Showing the solution cannot replace a finished result
      Given Alice has finished this puzzle by <finish>
      When Alice tries to show the solution after finishing
      Then Alice's action is refused because the puzzle is over
      And Alice's game log records that puzzle as <outcome>

      Examples:
        | finish               | outcome   |
        | solving it cleanly   | solved    |
        | showing the solution | failed    |
        | skipping it          | abandoned |

  Rule: To play or take a hint, the solver must return to the current position

    Scenario: The current position accepts a hint
      Given Alice has played g6-g5
      When Alice asks for a hint
      Then Alice's hint highlights the piece to move

    @regression:puzzle-history-command-accepted
    Scenario: An earlier position cannot accept another move
      Given Alice has played g6-g5
      And Alice is reviewing an earlier position in the puzzle
      When Alice tries a move from that earlier position
      Then Alice's action is refused because they are reviewing an earlier position
      And Alice's board is at move 2 of the line within 20 seconds
      And Alice's assistant explains that they are reviewing an earlier position

    @regression:puzzle-history-command-accepted
    Scenario: An earlier position cannot offer a hint for the opponent's move
      Given Alice has played g6-g5
      And Alice is reviewing an earlier position in the puzzle
      When Alice tries a hint from that earlier position
      Then Alice's action is refused because they are reviewing an earlier position
      And Alice's assistant explains that they are reviewing an earlier position

    @regression:puzzle-history-solution-accepted
    Scenario: An earlier position cannot start showing the solution
      Given Alice has played g6-g5
      And Alice is reviewing an earlier position in the puzzle
      When Alice tries to show the solution from that earlier position
      Then Alice's action is refused because they are reviewing an earlier position
      And Alice's assistant explains that they are reviewing an earlier position

  Rule: A wrong move needs a retry before another hint

    Scenario: Retrying allows another hint
      Given Alice has played a wrong move and retried
      When Alice asks for a hint
      Then Alice's hint highlights the piece to move

    @regression:puzzle-wrong-hint-accepted
    Scenario: A wrong move cannot bypass the retry
      Given Alice has played a wrong move
      When Alice tries to take a hint before retrying
      Then Alice's action is refused because a retry is needed
      And Alice's puzzle remains wrong

    Scenario: Another move cannot bypass the retry
      Given Alice has played a wrong move
      When Alice tries another move before retrying
      Then Alice's action is refused because a retry is needed
      And Alice's puzzle remains wrong

  Rule: The solution move is offered after the first hint

    Scenario: The second hint shows the solution move
      Given Alice has taken a hint
      When Alice asks for another hint
      Then Alice's hint shows the solution move

    @regression:puzzle-solution-before-hint
    Scenario: The first hint cannot be bypassed
      When Alice tries to see the solution move before a hint
      Then Alice's action is refused because the first hint is needed
      And Alice is still asked to find the next move

  Rule: The same first hint cannot repeat or replace later help

    Scenario: A first hint is available before any help
      When Alice asks for a hint
      Then Alice's hint highlights the piece to move

    @regression:puzzle-hint-help-regresses
    Scenario: Repeating the first hint is refused
      Given Alice has taken a hint
      When Alice tries the first hint again
      Then Alice's action is refused because the first hint is already taken
      And Alice's hint highlights the piece to move

    @regression:puzzle-hint-help-regresses
    Scenario: A first hint cannot replace the solution move
      Given Alice has seen the solution move
      When Alice tries the first hint again
      Then Alice's action is refused because the first hint is already taken
      And Alice's hint shows the solution move

  Rule: A wrong move or a skip needs a retry before reviewing positions

    Scenario: Retrying a wrong move allows reviewing earlier correct moves
      Given Alice has played g6-g5
      And Alice has played a wrong move and retried
      When Alice steps back one move in the puzzle
      Then Alice's board is at move 2 of the line within 20 seconds

    Scenario: A wrong move cannot start reviewing before a retry
      Given Alice has played g6-g5
      And Alice has played a wrong move
      When Alice tries to review an earlier puzzle position
      Then Alice's action is refused because a retry is needed
      And Alice's puzzle remains wrong

    Scenario: A skipped puzzle cannot start reviewing before a retry
      Given Alice has played g6-g5
      And Alice has skipped the puzzle
      When Alice tries to review an earlier puzzle position
      Then Alice's action is refused because the puzzle was skipped
      And Alice's puzzle remains skipped
