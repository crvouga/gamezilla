@domain:chess
Feature: Puzzles finished offline count once
  When a puzzle finishes offline (a clean solve, a hint, a wrong move, the
  solution, or a skip), the solver wants it logged the same way once the
  connection is back, so it counts exactly once without their doing anything.

  Rule: Every rated attempt finished offline counts once on all the account's devices

    Scenario Outline: A puzzle finished offline by <finish> is logged as <outcome>, once
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has finished the puzzle offline by <finish>
      When the connection comes back
      Then Alice's game log records that puzzle as <outcome>
      And Alice's stats show 1 played, <solved> solved, and <accuracy>% accuracy

      Examples:
        | finish                                          | outcome   | solved | accuracy |
        | solving it cleanly                              | solved    | 1      | 100      |
        | taking a hint, then solving it                  | solved    | 1      | 100      |
        | playing a wrong move, retrying, then solving it | failed    | 0      | 0        |
        | showing the solution                            | failed    | 0      | 0        |
        | skipping it                                     | abandoned | 0      | 0        |

  Rule: Closing the app as an attempt finishes preserves the first result

    Scenario Outline: The result arrives as the app closes
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice finishes the puzzle by <finish> as the app closes
      When Alice returns to their space
      Then Alice's game log records that puzzle as <outcome>
      And Alice's stats show 1 played, <solved> solved, and <accuracy>% accuracy

      Examples:
        | finish                                          | outcome   | solved | accuracy |
        | solving it cleanly                              | solved    | 1      | 100      |
        | taking a hint, then solving it                   | solved    | 1      | 100      |
        | playing a wrong move, retrying, then solving it  | failed    | 0      | 0        |
        | showing the solution                            | failed    | 0      | 0        |
        | skipping it                                     | abandoned | 0      | 0        |
