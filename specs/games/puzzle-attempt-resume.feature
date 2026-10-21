@domain:games
Feature: A puzzle attempt survives leaving the puzzle and closing the app
  When a solver steps away in the middle of a puzzle of the game, they want
  the same attempt waiting when they come back, so stepping away never skips
  a puzzle or starts a fresh one.

  Background:
    Given Alice is signed in
    And Alice is playing puzzles in their space

  Rule: An unfinished puzzle is the one waiting when the solver comes back

    Scenario: Going back to an unfinished puzzle resumes the same attempt
      Given Alice has played a wrong move
      And Alice has left the puzzle for the game's choices
      When Alice goes back to the puzzles
      Then Alice is on the same puzzle as before
      And Alice is told the move was wrong

    Scenario: A puzzle in progress when the app closed is waiting on return
      Given Alice has closed and reopened the app
      When Alice returns to their space
      Then Alice is asked to find the next move within 20 seconds
      And Alice is on the same puzzle as before

    Scenario: Going back after a finished puzzle starts the next one
      Given Alice has solved the puzzle
      And Alice has left the puzzle for the game's choices
      When Alice goes back to the puzzles
      Then Alice is solving a different puzzle than the one before
      And Alice is not offered the puzzle that is over

    @regression:puzzle-solved-review-resumes
    Scenario: Returning from an earlier position of a solved puzzle starts the next one
      Given Alice has solved the puzzle
      And Alice is reviewing an earlier position in the puzzle
      And Alice has left the puzzle for the game's choices
      When Alice goes back to the puzzles
      Then Alice is solving a different puzzle than the one before
      And Alice is not offered the puzzle that is over

  Rule: Moving on advances exactly one puzzle and works with no connection
    No counter-example: moving on before the puzzle is over is refused by play as a feed.

    Scenario: Asking for the next puzzle twice at once lands on one fresh puzzle
      Given Alice has solved the puzzle
      When Alice asks for the next puzzle twice in quick succession
      Then Alice is solving a different puzzle than the one before

    Scenario: Moving on to the next puzzle works without a connection
      Given Alice has solved the puzzle
      And Alice is offline
      When Alice moves on to the next puzzle
      Then Alice is solving a different puzzle than the one before

  Rule: Auto-advance moves on by itself after a solve
    No counter-example: without the setting the solver moves on themselves, which the rule above shows.

    Scenario: Auto-advance moves on by itself after a solve
      Given Alice has puzzles set to advance 1 second after a solve
      When Alice solves the puzzle
      Then Alice is on a different puzzle than the one before within 5 seconds
      And Alice's puzzle is not solved

  Rule: Going back from the game's choices reaches the game choice
    No counter-example: Going back from the game's choices always has this destination; going back from a board reaches the game's choices first.

    Scenario: The solver returns from the game's choices to the game choice
      Given Alice has left the puzzle for the game's choices
      When Alice goes back from the game's choices to the game choice
      Then Alice sees the space's game choice

  Rule: Reopening keeps the board and its result until the solver moves on
    No counter-example: Reopening preserves the current board; moving on is a separate choice.

    Scenario Outline: Reopening a finished puzzle retains its result
      Given Alice has finished this puzzle by <finish>
      When Alice reopens the app on the puzzle
      Then Alice's puzzle remains <state>

      Examples:
        | finish               | state    |
        | solving it cleanly   | solved   |
        | showing the solution | revealed |
        | skipping it          | skipped  |

    Scenario: Reopening a wrong move retains the chance to retry
      Given Alice has played a wrong move
      When Alice reopens the app on the puzzle
      Then Alice's puzzle remains wrong

  Rule: A puzzle in a space that can't be reached never keeps the solver waiting
    No counter-example: while the space can be reached, the first rule's puzzle is waiting on return.

    @regression:puzzle-unreachable-space-endless-loading
    Scenario: A puzzle left in a space that no longer exists never keeps the solver waiting
      Given Alice's space no longer exists
      And Alice has closed and reopened the app
      When Alice returns to their space
      Then Alice is told the space can't be reached right now within 15 seconds
      And Alice is offered the way back to Spaces
