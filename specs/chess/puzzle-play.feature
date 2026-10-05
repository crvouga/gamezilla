@domain:chess
Feature: Puzzle play is a feed
  When a solver finishes a puzzle, they want to see what it did to their
  rating and have the next one ready at once, so play flows like a feed and
  it is never the puzzle just played.

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

  Rule: As soon as a rated attempt's outcome is decided, the solver sees its rating change

    Scenario: A solve shows a rating change that raised the rating
      When Alice solves the puzzle
      Then Alice sees a rating change that raised their puzzle rating

    Scenario: A wrong move shows a rating change that lowered the rating
      When Alice plays a wrong move
      Then Alice sees a rating change that lowered their puzzle rating

    Scenario: A skip shows a rating change that lowered the rating
      When Alice skips the puzzle
      Then Alice sees a rating change that lowered their puzzle rating

    Scenario: A shown solution shows a rating change that lowered the rating
      When Alice shows the solution
      Then Alice sees a rating change that lowered their puzzle rating

    Scenario: A repeat of a played puzzle shows it is unrated instead of a rating change
      Given the puzzle pool holds just three puzzles
      And Alice has solved 3 puzzles in a row
      And Alice's feed has come round to a puzzle they already played
      When Alice solves the puzzle
      Then Alice is told the attempt is unrated
      And Alice sees no rating change

    Scenario: A watcher sees no rating change of their own
      Given Bob is watching Alice's puzzle
      When Alice solves the puzzle
      Then Alice sees a rating change that raised their puzzle rating
      And Bob sees no rating change

  Rule: The puzzle's own rating and the puzzle's themes are hidden while it is being solved and show once it is over

    Scenario: The puzzle's own rating and themes show once the puzzle is solved
      When Alice solves the puzzle
      Then Alice can see the puzzle's own rating
      And Alice can see the puzzle's themes

    Scenario: The puzzle's own rating and themes show once the puzzle is skipped
      When Alice skips the puzzle
      Then Alice can see the puzzle's own rating
      And Alice can see the puzzle's themes

    Scenario: The puzzle's own rating and themes cannot be seen while it is being solved
      When Alice asks for a hint
      Then Alice cannot see the puzzle's own rating
      And Alice cannot see the puzzle's themes
