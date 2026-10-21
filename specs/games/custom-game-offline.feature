@domain:games
Feature: Play a custom game on the host's device without a connection
  When a host plays without anyone else taking part, they want the board, bots and clock to work on their device, so shared play being unavailable never stops their own custom game. It holds for every game without a private setup; a custom game of a game with one needs the connection for its moves to count.

  Rule: The host can create a custom game and choose a bot without another person while offline
    No counter-example: being offline never stops the host's choices involving no other person.

    @regression:custom-game-offline-create-refused
    Scenario: An offline-created space can have a custom game
      Given Alice is hosting a space created offline
      When Alice creates a custom game
      Then Alice is the creator of the custom game
      And the first side is Alice and the second side is open

    Scenario: The host can choose a bot while offline
      Given Alice is setting up a custom game
      And Alice is offline
      When Alice assigns a bot to the second side
      Then the second side is a bot

  Rule: A host's custom game against a bot keeps going while offline
    No counter-example: a bot needs no other person, and the game's own endings still apply.

    Scenario: A timed bot still answers the offline host
      Given Alice has a custom game under way against a bot played at 5+2
      And Alice is offline
      When Alice makes her move
      Then the bot replies with a legal move within 5 seconds
      And it is Alice's turn

    Scenario: A host can finish their bot game without a connection
      Given Alice has a custom game under way against a bot
      And Alice is offline
      When Alice resigns the custom game
      Then the custom game is finished by resignation
      And the custom game is unrated

  Rule: Both bots can play for the offline host
    No counter-example: neither bot needs another person.

    Scenario: Two bots begin playing without a connection
      Given Alice is setting up a custom game
      And Alice has assigned bots to both sides
      And Alice is offline
      When Alice starts the custom game
      Then a legal move by the first side's bot follows within 5 seconds
      And a legal move by the second side's bot follows within 5 seconds

  Rule: Returning and reopening keep the same custom game on the host's device
    No counter-example: returning is not a rematch and cannot start another custom game.

    Scenario: Offline play survives reopening the app
      Given Alice has a custom game under way against a bot
      And Alice has made her move while offline
      When Alice closes and reopens the app
      Then the custom game keeps her move and the bot's reply
      And it is Alice's turn

    Scenario: Returning keeps the offline moves without making them twice
      Given Alice has a custom game under way against a bot
      And Alice has made her move while offline
      When the connection comes back
      Then the custom game keeps her move and the bot's reply
      And it is Alice's turn

    Scenario: An offline bot reply survives reopening before the connection comes back
      Given Alice has a custom game under way against a bot
      And Alice has made her move while offline
      And Alice has closed and reopened the app
      When the connection comes back
      Then the custom game keeps her move and the bot's reply
      And it is Alice's turn

    Scenario: A finished offline bot game remains finished on return
      Given Alice has resigned a custom game against a bot while offline
      When the connection comes back
      Then the custom game is finished by resignation
      And the custom game is unrated

  Rule: A watcher's missing connection does not stop the host's own custom game

    Scenario: The host's bot replies while a watcher is offline
      Given Alice has a custom game under way against a bot
      And Bob is watching the custom game while offline
      When Alice makes her move
      Then the bot replies with a legal move within 5 seconds
      And it is Alice's turn

    Scenario: An offline watcher cannot move for the host
      Given Alice has a custom game under way against a bot
      And Bob is watching the custom game while offline
      When Bob makes a move
      Then Bob is told the game needs a connection
      And it is Alice's turn
