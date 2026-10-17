@domain:games
Feature: A matched game is played and watched within spaces
  When a host finds an opponent, people in the space want to follow the matched game together, so both spaces share the same board, moves and clocks.

  Rule: Seeking an opponent and playing a matched game needs a space

    Scenario: A host seeks an opponent from the game's choices in the space
      Given Alice is signed in
      And Alice is hosting a space
      When Alice seeks an opponent for the game at 5+0
      Then Alice is waiting for an opponent at 5+0

    @regression:chess-matchmaking-outside-space
    Scenario: A person outside a space cannot seek an opponent
      Given Alice has a free account and a connection
      And Alice has left the space
      When Alice seeks an opponent for the game at 5+0
      Then Alice is told finding an opponent needs a space
      And Alice is not waiting for an opponent

  Rule: Guests in either space watch the same matched game
    No counter-example: every guest in either space can watch its host's matched game.

    @regression:chess-matchmaking-space-watchers
    Scenario: Guests in different spaces see the accepted move
      Given Alice and Bob have a matched game in different spaces
      And Carol is a guest watching Alice's matched game
      And Dave is a guest watching Bob's matched game
      When Alice makes her first move
      Then Carol and Dave see Alice's first move on the board
      And Carol and Dave cannot make a move

    Scenario: A guest arriving after a move sees the current board
      Given Alice has made her first move in a new matched game against Bob
      And Carol is a guest
      When Carol joins Alice's space
      Then Carol sees Alice's first move on the board
      And Carol cannot make a move

  Rule: Watching a matched game never gives a side

    Scenario: A matched host moves from their space
      Given Alice and Bob have a matched game in different spaces
      When Alice makes her first move
      Then both people see Alice's first move on the board

    Scenario: A guest watching a matched game cannot move
      Given Alice and Bob have a matched game in different spaces
      And Carol is a guest watching Alice's matched game
      When Carol makes a move in Alice's matched game
      Then Carol is told only the matched people can move
      And Alice and Bob keep the same matched game and board

    @regression:multiplayer-empty-board-unavailable
    Scenario: Someone outside either space cannot watch the matched game
      Given Alice and Bob have a matched game in different spaces
      When Carol opens Alice's matched game
      Then Carol is told no matched game is available to her

  Rule: Guests see the result only while in either space

    @regression:multiplayer-space-result-after-first-moves
    Scenario: A guest sees the result shared by the matched people
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      And Carol is a guest watching Alice's matched game
      When Bob resigns the matched game
      Then Carol sees Alice won the matched game
      And Carol cannot make a move

    Scenario: A guest who leaves no longer sees the matched game
      Given Alice and Bob have a matched game in different spaces
      And Carol is a guest watching Alice's matched game
      When Carol leaves the space
      Then Carol no longer sees the matched game

  Rule: A move accepted in one space is the same move list and the same clocks in the other, and a move from another device is in it once

    Scenario: The other person and both guests see the move that was accepted
      Given Alice and Bob have a matched game in different spaces
      And Carol is a guest watching Alice's matched game
      And Dave is a guest watching Bob's matched game
      When Alice makes her first move
      Then Bob, Carol and Dave see Alice's first move in the move list

    Scenario: A move from the other device appears once in both spaces
      Given Alice and Bob have a matched game in different spaces
      And Carol is a guest watching Alice's matched game
      And Dave is a guest watching Bob's matched game
      And Alice is also signed in on another device
      When Alice makes her first move on her other device
      Then Bob, Carol and Dave see Alice's first move in the move list

    Scenario: The phone cannot make that same move a second time
      Given Alice's first move was accepted from her other device
      When Alice makes her first move again on her phone
      Then Alice is told it is the other player's turn
      And Bob sees Alice's first move in the move list

    Scenario: Both spaces see the same clocks
      Given Alice has the first side against Bob in a 1+0 matched game after their first moves
      And Carol is a guest watching Alice's matched game
      And Dave is a guest watching Bob's matched game
      When 20 seconds pass
      Then Bob, Carol and Dave see 40 seconds on the first side's clock and 60 seconds on the second side's

    Scenario: A guest reviewing an earlier position leaves the other space on the current position
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      And Carol is a guest watching Alice's matched game
      And Dave is a guest watching Bob's matched game
      When Carol chooses the first move in the move list
      Then Bob's board still shows the current position
      And Dave sees both first moves in the move list

  Rule: Being idle leaves both spaces on the same matched game
    No counter-example: being idle never makes a move, and nobody is told the host is offline. Missing the first move aborts that same matched game, and after both people have moved the clock still runs.

    Scenario: Two minutes with nothing done shows the host idle and leaves the other person's matched game
      Given Alice and Bob have a matched game in different spaces
      And Carol is a guest watching Alice's matched game
      When Alice stays idle for 2 minutes
      Then Carol sees Alice is idle within 20 seconds
      And Bob keeps his matched game with Alice

  Rule: A missing connection does not give the other space a different matched game

    Scenario: The other space sees a move the offline phone does not
      Given Alice has made her first move in a new matched game against Bob
      And Dave is a guest watching Bob's matched game
      And Alice's phone is offline
      When Bob makes his first move
      Then Dave sees both first moves in the move list
      And Alice's phone keeps its last known board

    Scenario: An offline phone cannot add a move the other space would see
      Given Alice has the first side against Bob in a new matched game
      And Alice's phone is offline
      And Dave is a guest watching Bob's matched game
      When Alice makes her first move
      Then Alice is told the game needs a connection
      And Bob keeps his matched game with Alice

    Scenario: A guest with a connection sees the move the other space sees while the host is offline
      Given Alice has made her first move in a new matched game against Bob
      And Carol is a guest watching Alice's matched game
      And Alice's phone is offline
      When Bob makes his first move
      Then Carol sees both first moves in the move list
      And Carol is told the host is offline within 20 seconds

    Scenario: Another connected device of the host keeps the guest from being told the host is offline
      Given Alice and Bob have a matched game in different spaces
      And Alice's other device is in the space
      And Carol is a guest watching Alice's matched game
      When Alice's phone loses the connection
      Then Carol is not told the host is offline
      And Bob keeps his matched game with Alice

    Scenario: A guest who loses the connection is told, and the other person keeps the matched game
      Given Alice and Bob have a matched game in different spaces
      And Carol is a guest watching Alice's matched game
      When Carol loses the connection
      Then Carol is told the connection is missing within 15 seconds
      And Bob keeps his matched game with Alice

    Scenario: A guest whose connection comes back sees the move the other space has
      Given Alice has made her first move in a new matched game against Bob
      And Carol is a guest watching Alice's matched game
      And Carol's phone was offline when Bob's first move was accepted
      When the connection comes back
      Then Carol sees both first moves in the move list
      And Bob sees both first moves in the move list
