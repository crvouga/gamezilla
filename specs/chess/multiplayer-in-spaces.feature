@domain:chess
Feature: Multiplayer chess is played and watched within spaces
  When a host finds a chess opponent, people in the space want to follow
  the game together, so both spaces share the same multiplayer board.

  Rule: Finding an opponent and playing multiplayer chess requires a space

    Scenario: A host finds an opponent from the space's chess choices
      Given Alice is signed in
      And Alice is hosting a space
      When Alice finds a chess opponent
      Then Alice is looking for a chess opponent

    @regression:chess-matchmaking-outside-space
    Scenario: A person outside a space cannot find a chess opponent
      Given Alice has a free account and a connection
      And Alice is outside a space
      When Alice finds a chess opponent
      Then Alice is told multiplayer chess needs a space
      And Alice is not looking for a chess opponent

  Rule: Guests in either space watch the same multiplayer game
    No counter-example: every guest in either space can watch its host's accepted game.

    @regression:chess-matchmaking-space-watchers
    Scenario: Guests in different spaces see the accepted multiplayer move
      Given Alice and Bob have a multiplayer game in different spaces
      And Carol is a guest watching Alice's multiplayer game
      And Dave is a guest watching Bob's multiplayer game
      When Alice plays e2 to e4 as a multiplayer move
      Then Carol and Dave see the multiplayer pawn on e4
      And Carol and Dave cannot move multiplayer pieces

    Scenario: A guest arriving after a move sees the current multiplayer board
      Given Alice's multiplayer move e2 to e4 was accepted
      And Carol is a guest
      When Carol joins Alice's space
      Then Carol sees the multiplayer pawn on e4
      And Carol cannot move multiplayer pieces

  Rule: Watching a multiplayer game never grants a side

    Scenario: A matched host moves from their space
      Given Alice and Bob have a multiplayer game in different spaces
      When Alice plays e2 to e4 as a multiplayer move
      Then both multiplayer boards show the white pawn on e4

    Scenario: A guest watching a multiplayer game cannot move
      Given Alice and Bob have a multiplayer game in different spaces
      And Carol is a guest watching Alice's multiplayer game
      When Carol plays e2 to e4 in Alice's multiplayer game
      Then Carol is told only the matched people can move multiplayer pieces
      And Alice and Bob keep the same multiplayer board

    @regression:multiplayer-empty-board-unavailable
    Scenario: Someone outside either space cannot watch the multiplayer game
      Given Alice and Bob have a multiplayer game in different spaces
      When Carol opens Alice's multiplayer game
      Then Carol is told no multiplayer game is available to her

  Rule: Guests see the multiplayer result only while in either space

    @regression:multiplayer-space-result-after-first-moves
    Scenario: A guest sees the result shared by the matched people
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      And Carol is a guest watching Alice's multiplayer game
      When Bob resigns multiplayer chess
      Then Carol sees Alice won the multiplayer game
      And Carol cannot move multiplayer pieces

    Scenario: A guest who leaves no longer sees the multiplayer board
      Given Alice and Bob have a multiplayer game in different spaces
      And Carol is a guest watching Alice's multiplayer game
      When Carol leaves the space
      Then Carol has no multiplayer board
