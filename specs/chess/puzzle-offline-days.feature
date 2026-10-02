@domain:chess
Feature: Days of puzzles without a connection
  When a solver has puzzles on their device and no connection for days, they
  want to keep playing, so there are no errors, nothing blocked, and nothing
  lost or counted twice once the connection comes back.

  Rule: Puzzles already on the device keep the feed playing with no connection
    No counter-example: A puzzle already available on the device needs no connection to be played.

    Background:
      Given Alice is signed in
      And Alice is also signed in on another device
      And Alice is playing puzzles in their space
      And Alice is offline

    Scenario: After three days offline there is still a puzzle to play
      Given Alice has solved 10 puzzles a day for 3 days
      When Alice moves on to the next puzzle
      Then Alice has a puzzle on the board
      And Alice is not told the feed is empty

    Scenario: Three days of offline play all count once the connection comes back
      Given Alice has solved 10 puzzles a day for 3 days
      When the connection comes back
      Then Alice's stats show 30 played, 30 solved, and 100% accuracy
      And Alice's other device shows 30 played, 30 solved, and 100% accuracy
