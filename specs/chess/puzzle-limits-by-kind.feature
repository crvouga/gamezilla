@domain:chess
Feature: The puzzle limit holds everywhere, and only for guests
  When people play many puzzles in a day, they want the daily puzzle limit to
  be the same wherever they play, so their allowance is predictable. Free
  accounts and Plus members never meet it, and a guest's daily limit holds
  exactly the same offline as online.
  Puzzles played offline count, the answer does not change when the
  connection does, and a new day brings a fresh allowance.

  Rule: The daily puzzle limit counts a guest's puzzle starts online and offline and starts again each day

    Scenario Outline: Someone who <kind> and is past twenty puzzles in a day is never shown a limit
      Given Alice <kind>
      And Alice has played 25 puzzles today
      When Alice moves on to the next puzzle
      Then Alice has a puzzle on the board
      And Alice is not shown the puzzle limit

      Examples:
        | kind                   |
        | is signed in           |
        | has subscribed to Plus |

    Scenario: A guest at the limit still gets no new puzzle while offline
      Given Alice is a guest who has finished today's last allowed puzzle
      And Alice is offline
      When Alice asks for another puzzle
      Then Alice is told no new puzzle can start because today's allowance is used within 15 seconds
      And Alice has no puzzle on the board

    Scenario: Puzzles a guest plays offline count toward the day's limit
      Given Alice is a guest who has played 19 puzzles today
      And Alice is offline
      And Alice has solved the twentieth puzzle of the day
      When Alice asks for another puzzle
      Then Alice is told no new puzzle can start because today's allowance is used within 15 seconds

    Scenario: A new day brings a guest a fresh allowance
      Given Alice is a guest who has been shown today's puzzle limit
      And the next day has begun
      When Alice goes back to the puzzles
      Then Alice has a puzzle on the board within 30 seconds
      And Alice is not shown the puzzle limit
