@domain:chess
Feature: Puzzles finished offline count once
  When a puzzle finishes offline (a clean solve, a hint, a wrong move, the
  solution, or a skip), the solver wants it logged the same way once the
  connection is back, so it counts exactly once without their doing anything.

  Rule: Every rated attempt finished offline counts once on all the account's devices
    No counter-example: a finished rated attempt is always kept.

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

  Rule: Devices acting apart keep the result that reaches the account first
    No counter-example: A later device cannot replace a result the account already counts.

    Scenario Outline: An attempt finishing differently on two devices counts the first <outcome>
      Given Alice is signed in
      And Alice is also signed in on another device
      And Alice is playing puzzles in their space
      When Alice's attempt finishes on two devices with <first> reaching the account first
      Then Alice's stats show 1 played, <solved> solved, and <accuracy>% accuracy
      And Alice's other device shows 1 played, <solved> solved, and <accuracy>% accuracy

      Examples:
        | first             | outcome | solved | accuracy |
        | clean solve       | solved  | 1      | 100      |
        | wrong then solve  | failed  | 0      | 0        |

    Scenario Outline: A later device keeps the first recorded <outcome> result
      Given Alice is signed in
      And Alice is also signed in on another device
      And Alice is playing puzzles in their space
      And Alice's <first> result reached the account before the other device's <second> result
      When the connection comes back
      Then Alice's game log records that puzzle as <outcome>
      And Alice's stats show 1 played, <solved> solved, and <accuracy>% accuracy
      And Alice's other device shows 1 played, <solved> solved, and <accuracy>% accuracy

      Examples:
        | first             | second            | outcome | solved | accuracy |
        | clean solve       | wrong then solve  | solved  | 1      | 100      |
        | wrong then solve  | clean solve       | failed  | 0      | 0        |

  Rule: Closing the app as an attempt finishes preserves the first result
    No counter-example: returning cannot refuse a decided result.

    @regression:puzzle-result-lost-as-app-closes
    Scenario Outline: Finishing by <finish> as the app closes keeps the result
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has finished the puzzle by <finish> as the app closes
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

    @regression:harness-room-created-while-offline
    @regression:puzzle-result-lost-by-stats-navigation
    Scenario: Returning offline keeps the result for the next connection
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has finished the puzzle by playing a wrong move, retrying, then solving it as the app closes
      And Alice is offline
      And Alice has returned to their space
      When the connection comes back
      Then Alice's game log records that puzzle as failed
      And Alice's stats show 1 played, 0 solved, and 0% accuracy

    Scenario: Reading stats offline before hearing the finish keeps its result
      Given Alice is signed in
      And Alice is playing puzzles in their space
      And Alice has finished the puzzle by playing a wrong move, retrying, then solving it as the app closes
      And Alice is viewing their puzzle stats offline
      When the connection comes back
      Then Alice's game log records that puzzle as failed
      And Alice's stats show 1 played, 0 solved, and 0% accuracy
