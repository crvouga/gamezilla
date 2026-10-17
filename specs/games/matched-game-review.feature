@domain:games
Feature: Review earlier positions in a matched game
  When a person wants to see how their matched game reached where it stands, they want to review any earlier position on their own device, so they can follow the game without changing it for anyone.

  Rule: Each person of a matched game and every watcher can review any earlier position on their own device, whether the matched game is unfinished, over or aborted

    Scenario: Choosing a move in the move list shows that earlier position on the person's own board only
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Alice chooses the first move in the move list
      Then Alice's board shows the earlier position after the first move
      And Bob's board still shows the current position
      And it is Alice's turn

    Scenario: The keyboard's left arrow steps back one move
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Alice steps back one move in the move list with the keyboard's left arrow
      Then Alice's board shows the earlier position after the first move

    Scenario: The keyboard's right arrow steps forward one move and reaches the current position
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      And Alice is reviewing the earlier position after the first move
      When Alice steps forward one move in the move list with the keyboard's right arrow
      Then Alice's board shows the current position

    Scenario: Going to the start shows the board before any move, in an aborted matched game too
      Given Alice's 5+0 matched game with Bob was aborted after her first move
      When Alice goes to the start of the move list
      Then Alice's board shows the earlier position at the start of the game
      And Alice sees the matched game was aborted

    Scenario: A watcher reviews an earlier position of a matched game that is over
      Given Bob has resigned the matched game after their first moves
      And Carol is a guest watching Alice's matched game
      When Carol chooses the first move in the move list
      Then Carol's board shows the earlier position after the first move
      And Carol sees Alice won the matched game

    Scenario: A matched game with no moves has no earlier position to review
      Given Alice has the first side against Bob in a new matched game
      When Alice steps back one move in the move list with the keyboard's left arrow
      Then Alice cannot review an earlier position
      And both people's boards still show the starting position

  Rule: An earlier position is only for reviewing: no move can be made on it, and a move accepted meanwhile leaves the person's board where it was until they return to the current position

    Background:
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves

    Scenario: No move can be made on an earlier position
      Given Alice is reviewing the earlier position after the first move
      When Alice makes her move
      Then Alice is told she is reviewing an earlier position
      And both people see the two moves played

    Scenario: A move accepted while a person reviews an earlier position joins the move list and leaves their board where it was
      Given Bob is reviewing the earlier position after the first move
      When Alice makes her move
      Then Bob's board still shows the earlier position after the first move
      And both people see both first moves and Alice's next move in the move list

    Scenario: Returning to the current position shows the move accepted meanwhile
      Given Bob was reviewing the earlier position after the first move when Alice's next move was accepted
      When Bob returns to the current position
      Then Bob's board shows the current position with Alice's next move

  Rule: Reviewing an earlier position needs no connection
    No counter-example: reviewing an earlier position uses only the last known board the device already shows.

    Scenario: An offline person reviews an earlier position on their last known board
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      And Alice's phone is offline
      When Alice chooses the first move in the move list
      Then Alice's board shows the earlier position after the first move
