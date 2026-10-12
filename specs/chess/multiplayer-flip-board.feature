@domain:chess
Feature: Flip the multiplayer board
  When a person wants to see their multiplayer game from the other side,
  they want to flip the board on their own device, so they can look at the
  game as their multiplayer opponent does without changing it.

  Rule: A person or a watcher can flip the board to see it from the other side and flip it back, and the two people's names, multiplayer ratings and multiplayer clocks change places with it
    No counter-example: flipping the board is open to everyone who has the multiplayer board in front of them.

    Background:
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5

    Scenario: Flipping the board shows it from the other side, with the multiplayer opponent's name, multiplayer rating and multiplayer clock nearest the person
      When Alice flips the board
      Then Alice's multiplayer board faces Black
      And Alice sees Bob's name, multiplayer rating and multiplayer clock nearest her

    Scenario: Flipping the board a second time shows it from the person's own side again
      Given Alice has flipped the board
      When Alice flips the board
      Then Alice's multiplayer board faces White

    Scenario: A watcher flips the board from White's side to Black's
      Given Carol is a guest watching Alice's multiplayer game
      When Carol flips the board
      Then Carol's multiplayer board faces Black

  Rule: Flipping the board is private to the device, never moves a piece or changes whose turn it is, and needs no connection

    Background:
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5

    Scenario: Flipping the board changes nobody else's board and nobody's turn
      When Alice flips the board
      Then Bob's multiplayer board faces Black
      And Alice has the multiplayer turn
      And both multiplayer boards still show two moves

    Scenario: A flipped board stays flipped while its person plays on
      Given Alice has flipped the board
      When Alice plays g1 to f3 as a multiplayer move
      Then Bob has the multiplayer turn
      And Alice's multiplayer board faces Black

    Scenario: An offline person flips their last known multiplayer board
      Given Alice's phone is offline
      When Alice flips the board
      Then Alice's multiplayer board faces Black

  Rule: A new multiplayer game starts from the person's own side again, and a watcher's from White's side
    No counter-example: every new multiplayer game starts this way; flipping the board afterwards is the first rule.

    Scenario: A multiplayer rematch shows a person who had flipped the board their own new side
      Given Alice was White and Bob was Black in their finished 5+0 multiplayer game
      And Alice has flipped the board
      And Bob has offered Alice a multiplayer rematch
      When Alice accepts the multiplayer rematch
      Then Alice's multiplayer board faces Black

    Scenario: A multiplayer rematch shows a person who had not flipped the board their own new side
      Given Alice was White and Bob was Black in their finished 5+0 multiplayer game
      And Bob has offered Alice a multiplayer rematch
      When Alice accepts the multiplayer rematch
      Then Bob's multiplayer board faces White

    Scenario: A multiplayer rematch shows a watcher who had flipped the board White's side again
      Given Bob has offered Alice a multiplayer rematch
      And Carol is a guest watching Alice's multiplayer game
      And Carol has flipped the board
      When Alice accepts the multiplayer rematch
      Then Carol's multiplayer board faces White
