@domain:games
Feature: A matched game needs a connection to change anything
  When a person's device is offline, they want to see where their matched game and search stood, so nothing they try offline changes a game behind their opponent's back.

  Rule: An offline person sees their last known board but cannot change the matched game

    Scenario: An offline person keeps seeing their last known board
      Given Alice has the first side against Bob in a new matched game
      And Alice's phone is offline
      When Alice opens finding an opponent
      Then Alice's phone keeps its last known board

    Scenario: An offline person cannot resign
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      And Alice's phone is offline
      When Alice resigns the matched game
      Then Alice is told the game needs a connection
      And the matched game is still unfinished

    Scenario: An offline person cannot abort the matched game
      Given Alice has the first side against Bob in a new matched game
      And Alice's phone is offline
      When Alice aborts the matched game
      Then Alice is told the game needs a connection
      And the matched game is still unfinished

    Scenario: An offline person cannot offer a draw
      Given Alice has the first side against Bob in a new matched game
      And Alice's phone is offline
      When Alice offers a draw
      Then Alice is told the game needs a connection
      And neither person is offered a draw

    Scenario: An offline person cannot accept a draw
      Given Bob has offered Alice a draw in their matched game
      And Alice's phone is offline
      When Alice accepts the draw
      Then Alice is told the game needs a connection
      And the matched game is still unfinished

    Scenario: An offline person cannot decline a draw
      Given Bob has offered Alice a draw in their matched game
      And Alice's phone is offline
      When Alice declines the draw
      Then Alice is told the game needs a connection
      And Alice is still offered a draw

  Rule: An offline person sees their last known search but cannot change it or a rematch

    Scenario: An offline person keeps seeing their last known search
      Given Alice is seeking an opponent for the game at 5+0
      And Alice's phone is offline
      When Alice opens finding an opponent
      Then Alice is still waiting for an opponent at 5+0

    Scenario: An offline person cannot stop seeking an opponent
      Given Alice is seeking an opponent for the game at 5+0
      And Alice's phone is offline
      When Alice stops seeking an opponent
      Then Alice is told finding an opponent needs a connection
      And Alice is still waiting with her same search

    Scenario: An offline person cannot find a new opponent
      Given Alice's 5+0 matched game with Bob is finished
      And Alice's phone is offline
      When Alice finds a new opponent
      Then Alice is told finding an opponent needs a connection
      And Alice is not waiting for an opponent

    Scenario: An offline person cannot offer a rematch
      Given Alice's 5+0 matched game with Bob is finished
      And Alice's phone is offline
      When Alice offers a rematch
      Then Alice is told the game needs a connection
      And neither person is offered a rematch

    Scenario: An offline person cannot accept a rematch
      Given Bob has offered Alice a rematch
      And Alice's phone is offline
      When Alice accepts the rematch
      Then Alice is told the game needs a connection
      And Alice is offered a rematch

    Scenario: An offline person cannot decline a rematch
      Given Bob has offered Alice a rematch
      And Alice's phone is offline
      When Alice declines the rematch
      Then Alice is told the game needs a connection
      And Alice is offered a rematch
