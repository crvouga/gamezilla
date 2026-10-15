@domain:chess
Feature: Keep a Custom Game on the host's device without a connection
  When a host plays without anyone else's participation, they want the board, bots and clock to work on their device, so shared play being unavailable never stops their own game.

  Rule: A host's game against a bot keeps playing while offline
    No counter-example: a bot needs no other person's participation and ordinary chess endings still apply.

    Scenario: A timed bot still answers the offline host
      Given Alice has an active Custom Game against a bot as Black
      And the Custom Game has 5 minutes with 2 seconds increment
      And Alice is offline
      When Alice plays e2-e4 in the Custom Game
      Then A legal Black bot move follows within 5 seconds
      And White is to move in the Custom Game

    Scenario: A host can finish their bot game without a connection
      Given Alice has an active Custom Game against a bot as Black
      And Alice is offline
      When Alice resigns the Custom Game
      Then The Custom Game is completed by resignation
      And The Custom Game is unrated

  Rule: Both bots can play for the offline host
    No counter-example: neither bot needs another person's participation.

    Scenario: Two bots begin playing without a connection
      Given Alice has a configuring Custom Game
      And White and Black in the Custom Game are bots
      And Alice is offline
      When Alice starts the Custom Game
      Then A legal White bot move follows within 5 seconds
      And A legal Black bot move follows within 5 seconds

  Rule: Returning and reopening preserve the same local game
    No counter-example: returning is not a rematch and cannot start another game.

    Scenario: An offline bot reply survives reopening before the connection returns
      Given Alice has an active Custom Game against a bot as Black
      And Alice has played e2-e4 in the Custom Game while offline
      And Alice has closed and reopened the app
      When the connection comes back
      Then The Custom Game keeps the opening move and the bot reply
      And White is to move in the Custom Game

    Scenario: A finished offline bot game remains finished on return
      Given Alice has completed a Custom Game against a bot by resignation while offline
      When the connection comes back
      Then The Custom Game is completed by resignation
      And The Custom Game is unrated

  Rule: A watcher's missing connection does not stop the host's own game

    Scenario: The host's bot replies while a watcher is away
      Given Alice has an active Custom Game against a bot as Black
      And Bob is watching the Custom Game while offline
      When Alice plays e2-e4 in the Custom Game
      Then A legal Black bot move follows within 5 seconds
      And White is to move in the Custom Game

    Scenario: An offline watcher cannot play for the host
      Given Alice has an active Custom Game against a bot as Black
      And Bob is watching the Custom Game while offline
      When Bob plays e2-e4 in the Custom Game
      Then Bob is told Custom Games need a connection
      And White is to move in the Custom Game
