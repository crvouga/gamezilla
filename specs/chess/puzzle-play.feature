@domain:chess
Feature: Puzzle play is a feed
  When a solver finishes a puzzle, they want the next one ready at once, so
  play flows like a feed and it is never the puzzle just played.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Rule: Once a puzzle is over, moving on serves a different puzzle, and not before

    Scenario Outline: Moving on after a finished puzzle serves a different one
      Given Alice has finished this puzzle by <finish>
      When Alice moves on to the next puzzle
      Then Alice is solving a different puzzle than the one before

      Examples:
        | finish               |
        | solving it cleanly   |
        | showing the solution |
        | skipping it          |

    Scenario: Moving on while the puzzle is still being solved is not offered
      When Alice asks for the next puzzle
      Then Alice is not offered to move on
      And Alice is on the same puzzle as before

    Scenario: A wrong move needs a retry before moving on is offered
      Given Alice has played a wrong move
      When Alice asks for the next puzzle
      Then Alice is not offered to move on
      And Alice's puzzle remains wrong
