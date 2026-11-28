@domain:games
Feature: Play a game session on the host's device without a connection
  When a host plays without anyone else taking part, they want the board, bots and clock to work on their device, so shared play being unavailable never stops their own game session. It holds for every game without a private setup; a game session of a game with one needs the connection for its moves to count.

  Rule: The host can create a game session and choose a bot without another person while offline
    No counter-example: being offline never stops the host's choices involving no other person.

    @regression:game-session-offline-create-refused
    Scenario: An offline-created space can have a game session
      Given Alice is hosting a space created offline
      When Alice creates a game session
      Then Alice is the creator of the game session
      And the first side is Alice and the second side is open

    Scenario: The host can choose a bot while offline
      Given Alice is setting up a game session
      And Alice is offline
      When Alice assigns a bot to the second side
      Then the second side is a bot

  Rule: A host's game session against a bot keeps going while offline
    No counter-example: a bot needs no other person, and the game's own endings still apply.

    Scenario: A timed bot still answers the offline host
      Given Alice has a game session under way against a bot played at 5+2
      And Alice is offline
      When Alice makes her move
      Then the bot replies with a legal move within 5 seconds
      And it is Alice's turn

    @regression:game-session-offline-bot-stops
    Scenario: The offline host's move receives the bot's reply
      Given Alice has a game session under way against a bot while offline
      When Alice makes her move on the board
      Then the bot replies with a legal move within 5 seconds
      And it is Alice's turn

    Scenario: A host can finish their bot game without a connection
      Given Alice has a game session under way against a bot
      And Alice is offline
      When Alice resigns the game session
      Then the game session is finished by resignation
      And the game session is unrated

  Rule: Both bots can play for the offline host
    No counter-example: neither bot needs another person.

    Scenario: Two bots begin playing without a connection
      Given Alice is setting up a game session
      And Alice has assigned bots to both sides
      And Alice is offline
      When Alice starts the game session
      Then a legal move by the first side's bot follows within 5 seconds
      And a legal move by the second side's bot follows within 5 seconds

  Rule: Returning and reopening keep the same game session on the host's device
    No counter-example: returning is not a rematch and cannot start another game session.

    Scenario: Offline play survives reopening the app
      Given Alice has a game session under way against a bot
      And Alice has made her move while offline
      When Alice closes and reopens the app
      Then the game session keeps her move and the bot's reply
      And it is Alice's turn

    Scenario: Returning keeps the offline moves without making them twice
      Given Alice has a game session under way against a bot
      And Alice has made her move while offline
      When the connection comes back
      Then the game session keeps her move and the bot's reply
      And it is Alice's turn

    Scenario: An offline bot reply survives reopening before the connection comes back
      Given Alice has a game session under way against a bot
      And Alice has made her move while offline
      And Alice has closed and reopened the app
      When the connection comes back
      Then the game session keeps her move and the bot's reply
      And it is Alice's turn

    Scenario: A finished offline bot game remains finished on return
      Given Alice has resigned a game session against a bot while offline
      When the connection comes back
      Then the game session is finished by resignation
      And the game session is unrated

  Rule: A watcher's missing connection does not stop the host's own game session

    Scenario: The host's bot replies while a watcher is offline
      Given Alice has a game session under way against a bot
      And Bob is watching the game session while offline
      When Alice makes her move
      Then the bot replies with a legal move within 5 seconds
      And it is Alice's turn

    Scenario: An offline watcher cannot move for the host
      Given Alice has a game session under way against a bot
      And Bob is watching the game session while offline
      When Bob makes a move
      Then Bob is told the game needs a connection
      And it is Alice's turn
