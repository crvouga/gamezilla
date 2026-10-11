@domain:chess
Feature: Review earlier positions in a multiplayer game
  When a person wants to see how their multiplayer game reached where it
  stands, they want to review any earlier position on their own device, so
  they can follow the game without changing it for anyone.

  Rule: Each person of a multiplayer game and every watcher can review any earlier position on their own device, whether the game is unfinished, over or aborted

    Scenario: Choosing a move in the multiplayer move list shows that earlier position on the person's own board only
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      When Alice chooses e4 in the multiplayer move list
      Then Alice's multiplayer board shows the earlier position after e4
      And Bob's multiplayer board still shows the current position after e5
      And Alice has the multiplayer turn

    Scenario: The keyboard's left arrow steps back one move
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      When Alice steps back one move in the multiplayer move list with the keyboard's left arrow
      Then Alice's multiplayer board shows the earlier position after e4

    Scenario: The keyboard's right arrow steps forward one move and reaches the current position
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      And Alice is reviewing the earlier position after e4 in the multiplayer game
      When Alice steps forward one move in the multiplayer move list with the keyboard's right arrow
      Then Alice's multiplayer board shows the current position after e5

    Scenario: Going to the start shows the board before any move, in an aborted game too
      Given Alice's 5+0 multiplayer game with Bob was aborted after e4
      When Alice goes to the start of the multiplayer move list
      Then Alice's multiplayer board shows the earlier position at the start of the game
      And Alice sees the multiplayer game was aborted

    Scenario: A watcher reviews an earlier position of a multiplayer game that is over
      Given Bob resigned multiplayer chess after the multiplayer moves e4 and e5
      And Carol is a guest watching Alice's multiplayer game
      When Carol chooses e4 in the multiplayer move list
      Then Carol's multiplayer board shows the earlier position after e4
      And Carol sees Alice won the multiplayer game

    Scenario: A multiplayer game with no moves has no earlier position to review
      Given Alice is White and Bob is Black in a new multiplayer game
      When Alice steps back one move in the multiplayer move list with the keyboard's left arrow
      Then Alice cannot review an earlier position in the multiplayer game
      And both multiplayer boards keep their starting position

  Rule: An earlier position is only for reviewing: no piece can be moved on it, and a move accepted meanwhile leaves the person's board where it was until they return to the current position

    Background:
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5

    Scenario: A piece cannot be moved on an earlier position
      Given Alice is reviewing the earlier position after e4 in the multiplayer game
      When Alice plays g1 to f3 as a multiplayer move
      Then Alice is told she is reviewing an earlier position in the multiplayer game
      And both people see the multiplayer move list "1. e4 e5"

    Scenario: A move accepted while a person reviews an earlier position joins the multiplayer move list and leaves their board where it was
      Given Bob is reviewing the earlier position after e4 in the multiplayer game
      When Alice plays g1 to f3 as a multiplayer move
      Then Bob's multiplayer board still shows the earlier position after e4
      And both people see the multiplayer move list "1. e4 e5 2. Nf3"

    Scenario: Returning to the current position shows the move accepted meanwhile
      Given Bob was reviewing the earlier position after e4 in the multiplayer game when Alice's move Nf3 was accepted
      When Bob returns to the current position in the multiplayer game
      Then Bob's multiplayer board shows the current position after Nf3

  Rule: Reviewing an earlier position needs no connection
    No counter-example: reviewing an earlier position uses only the last known multiplayer board the device already shows.

    Scenario: An offline person reviews an earlier position on their last known multiplayer board
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      And Alice's phone is offline
      When Alice chooses e4 in the multiplayer move list
      Then Alice's multiplayer board shows the earlier position after e4

  Rule: A person listening to the app is told which earlier position they are reviewing
    No counter-example: descriptions are always present for a person listening to the app.

    Scenario: A person listening to the app hears which earlier position they are reviewing
      Given Alice is listening to her 5+0 multiplayer game with Bob after e4 and e5
      When Alice chooses e4 in the multiplayer move list
      Then Alice hears she is reviewing the earlier position after e4 in the multiplayer game
