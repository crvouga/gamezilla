@domain:games
Feature: Keep the game session through a lost connection
  When a person loses the connection, they want their agreed game session kept and the current one shown on return, so an old choice cannot take over after others have moved on.

  Rule: A choice involving another person needs a connection, and a refused choice never happens later

    Scenario: Being back online allows a fresh claim
      Given Alice is setting up a game session
      And Bob is in Alice's space
      And Bob is back online after his offline claim was refused
      When Bob claims the second side
      Then the second side is Bob

    Scenario: An offline claim does not reserve a side
      Given Alice is setting up a game session
      And Bob is in Alice's space
      And Bob is offline
      When Bob claims the second side
      Then Bob is told the game needs a connection
      And the second side is open

    Scenario: An offline start cannot start the game session later
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      And Alice is offline
      When Alice starts the game session
      Then Alice is told the game needs a connection
      And the game session is still being set up

  Rule: A returning person sees the current choices and result

    @regression:game-session-reconnect-read-before-settlement
    Scenario: A returning participant sees the game session that started while he was offline
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      And Bob is offline
      And Alice has started the game session
      When the connection comes back
      Then Bob sees the game session under way with the first side to move

    @regression:space-join-preview-grants-stale
    @regression:game-session-reconnect-read-before-settlement
    Scenario: A returning participant cannot revive a finished game session
      Given Alice and Bob have a game session under way
      And Bob is offline
      And Alice has resigned the game session
      When the connection comes back
      Then Bob sees the finished game session
      And Bob cannot make a move

  Rule: Acknowledged choices survive closing the app

    Scenario: A bot choice is kept after reopening
      Given Alice is setting up a game session
      And Alice has assigned a bot to the second side
      When Alice closes and reopens the app
      Then the second side is a bot

    Scenario: An earlier choice cannot overwrite a newer set-up
      Given Alice is setting up a game session
      And the second side has since been replaced by a bot
      When Alice opens the second side with the earlier set-up
      Then Alice is told the game session's set-up has changed
      And the second side is a bot
