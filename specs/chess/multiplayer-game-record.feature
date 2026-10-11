@domain:chess
Feature: Copy the game record of a finished multiplayer game
  When a multiplayer game is over, its people and watchers want to keep it,
  so they can copy its game record or its final position and go through the
  game in another chess program.

  Rule: Once a multiplayer game is over with a multiplayer result, each of its people and anyone watching can copy its game record and its final position; an unfinished or aborted game offers neither

    Scenario: A watcher is offered the game record and the final position as soon as the multiplayer game is over
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      And Carol is a guest watching Alice's multiplayer game
      When Bob resigns multiplayer chess
      Then Carol is offered the game record and the final position

    Scenario: A person copies the final position of a multiplayer game that is over
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      And Bob has resigned multiplayer chess
      When Alice copies the final position
      Then the final position Alice copied is the position after e5 with White to move

    Scenario: An unfinished multiplayer game offers its people neither and still shows the multiplayer move list
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      When Alice opens multiplayer chess
      Then Alice is not offered the game record or the final position
      And Alice sees the multiplayer move list "1. e4 e5"

    Scenario: An unfinished multiplayer game offers a watcher neither
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      And Carol is a guest watching Alice's multiplayer game
      When Alice plays g1 to f3 as a multiplayer move
      Then Carol is not offered the game record or the final position

    Scenario: An aborted multiplayer game offers neither
      Given Alice's 5+0 multiplayer game with Bob was aborted after e4
      When Alice opens multiplayer chess
      Then Alice is not offered the game record or the final position

    Scenario: A multiplayer rematch offers neither while it is unfinished
      Given Bob has offered Alice a multiplayer rematch
      When Alice accepts the multiplayer rematch
      Then Alice is not offered the game record or the final position

  Rule: A game record gives White's and Black's usernames, the multiplayer result, the time control and every move in algebraic notation, the way other chess programs read one
    No counter-example: the person copying chooses nothing about what a game record holds.

    Scenario: The game record of a multiplayer game White won names both people and gives the multiplayer result as 1-0
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      And Bob has resigned multiplayer chess
      When Alice copies the game record
      Then the game record Alice copied names Alice as White and Bob as Black
      And the game record Alice copied gives the multiplayer result as 1-0, the time control as 5+0 and the moves as "1. e4 e5"

    Scenario: The game record of a multiplayer game Black won gives the multiplayer result as 0-1 and opens in another chess program
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      And Alice has resigned multiplayer chess
      When Bob copies the game record
      Then the game record Bob copied gives the multiplayer result as 0-1, the time control as 5+0 and the moves as "1. e4 e5"
      And the game record Bob copied can be opened in another chess program

    Scenario: The game record of a drawn multiplayer game gives the multiplayer result as 1/2-1/2
      Given Alice's 5+0 multiplayer game with Bob was drawn by agreement after e4 and e5
      When Alice copies the game record
      Then the game record Alice copied gives the multiplayer result as 1/2-1/2, the time control as 5+0 and the moves as "1. e4 e5"

  Rule: A game record names each person as everyone sees them now: by their current username, or by their stand-in name
    No counter-example: changing a username changes the name a game record gives, never the game it holds.

    Scenario: A game record names a person by the username they have now
      Given Alice's 5+0 multiplayer game with Bob was drawn by agreement after e4 and e5
      And Alice has renamed themselves to @alice_atlas
      When Bob copies the game record
      Then the game record Bob copied names Alice as @alice_atlas

    Scenario: A game record names a person shown under a stand-in name by that stand-in name
      Given Alice's username is @chess_cheater
      And Alice's 5+0 multiplayer game with Bob was drawn by agreement after e4 and e5
      And the team has stopped allowing the username @chess_cheater
      When Bob copies the game record
      Then the game record Bob copied names Alice by her stand-in name
