@domain:games
Feature: Copy the game record of a finished matched game
  When a matched game is over, its people and watchers want to keep it, so they can copy its game record or its final position and go through the game again.

  Rule: Once a matched game is over with a result, each of its people and anyone watching can copy its game record and its final position; an unfinished or aborted matched game offers neither

    Scenario: A watcher is offered the game record and the final position as soon as the matched game is over
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      And Carol is a guest watching Alice's matched game
      When Bob resigns the matched game
      Then Carol is offered the game record and the final position

    Scenario: A person copies the final position of a matched game that is over
      Given Bob has resigned the matched game after their first moves
      When Alice copies the final position
      Then the final position Alice copied is the position after their first moves

    Scenario: An unfinished matched game offers its people neither and still shows the move list
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Alice opens finding an opponent
      Then Alice is not offered the game record or the final position
      And Alice sees both first moves in the move list

    Scenario: An unfinished matched game offers a watcher neither
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      And Carol is a guest watching Alice's matched game
      When Alice makes her move
      Then Carol is not offered the game record or the final position

    Scenario: An aborted matched game offers neither
      Given Alice's 5+0 matched game with Bob was aborted after her first move
      When Alice opens finding an opponent
      Then Alice is not offered the game record or the final position

    Scenario: A rematch offers neither while it is unfinished
      Given Bob has offered Alice a rematch
      When Alice accepts the rematch
      Then Alice is not offered the game record or the final position

  Rule: A game record gives the usernames on the first and second sides, the result, the clock choice and every move, in the game's own notation
    No counter-example: the person copying chooses nothing about what a game record holds.

    Scenario: The game record of a matched game the first side won names both people and gives the first side's victory
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      And Bob has resigned the matched game
      When Alice copies the game record
      Then the game record Alice copied names Alice on the first side and Bob on the second side
      And the game record Alice copied gives a victory for the first side, the clock choice 5+0 and both first moves

    Scenario: The game record of a matched game the second side won gives the second side's victory
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      And Alice has resigned the matched game
      When Bob copies the game record
      Then the game record Bob copied gives a victory for the second side, the clock choice 5+0 and both first moves

    Scenario: The game record of a drawn matched game gives the draw
      Given Alice's 5+0 matched game with Bob was drawn by agreement after their first moves
      When Alice copies the game record
      Then the game record Alice copied gives a draw, the clock choice 5+0 and both first moves

  Rule: A game record names each person as everyone sees them now: by their current username, or by their stand-in name
    No counter-example: changing a username changes the name a game record gives, never the matched game it holds.

    Scenario: A game record names a person by the username they have now
      Given Alice's 5+0 matched game with Bob was drawn by agreement after their first moves
      And Alice has renamed themselves to @alice_atlas
      When Bob copies the game record
      Then the game record Bob copied names Alice as @alice_atlas

    Scenario: A game record names a person shown under a stand-in name by that stand-in name
      Given Alice's username is @board_cheater
      And Alice's 5+0 matched game with Bob was drawn by agreement after their first moves
      And the team has stopped allowing the username @board_cheater
      When Bob copies the game record
      Then the game record Bob copied names Alice by her stand-in name

  Rule: Either space can copy the one game record once the matched game is over, and an unfinished matched game offers it to neither

    Background:
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves

    Scenario: Resigning offers both spaces the same game record
      Given Carol is a guest watching Alice's matched game
      And Dave is a guest watching Bob's matched game
      When Bob resigns the matched game
      Then Carol is offered the game record and the final position
      And Dave is offered the game record and the final position

    Scenario: A guest in the other space copies the same game record
      Given Dave is a guest watching Bob's matched game
      And Bob has resigned the matched game
      When Dave copies the game record
      Then the game record Dave copied gives a victory for the first side, the clock choice 5+0 and both first moves

    Scenario: Another device copies the same game record
      Given Bob has resigned the matched game
      And Alice is also signed in on another device
      When Alice copies the game record on another device
      Then the game record Alice copied gives a victory for the first side, the clock choice 5+0 and both first moves

    Scenario: An offline phone copies the same game record
      Given Bob has resigned the matched game
      And Alice's phone is offline
      When Alice copies the game record
      Then the game record Alice copied gives a victory for the first side, the clock choice 5+0 and both first moves

    Scenario: An unfinished matched game offers the other space's guest neither
      Given Dave is a guest watching Bob's matched game
      When Alice makes her move
      Then Dave is not offered the game record or the final position
      And Dave sees both first moves and Alice's next move in the move list

  Rule: Being idle adds nothing to the game record
    No counter-example: losing the connection cannot add a move, and an unfinished matched game offers no game record.

    Scenario: Resigning while the other person is idle records the resignation
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      And Alice has been idle for 2 minutes
      And Carol is a guest watching Alice's matched game
      And Bob has resigned the matched game
      When Carol copies the game record
      Then the game record Carol copied gives a victory for the first side, the clock choice 5+0 and both first moves
