@domain:games
Feature: Keep the custom game through a lost connection
  When a person loses the connection, they want their agreed custom game kept and the current one shown on return, so an old choice cannot take over after others have moved on.

  Rule: A choice involving another person needs a connection, and a refused choice never happens later

    Scenario: Being back online allows a fresh claim
      Given Alice is setting up a custom game
      And Bob is in Alice's space
      And Bob is back online after his offline claim was refused
      When Bob claims the second side
      Then the second side is Bob

    Scenario: An offline claim does not reserve a side
      Given Alice is setting up a custom game
      And Bob is in Alice's space
      And Bob is offline
      When Bob claims the second side
      Then Bob is told the game needs a connection
      And the second side is open

    Scenario: An offline start cannot start the custom game later
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      And Alice is offline
      When Alice starts the custom game
      Then Alice is told the game needs a connection
      And the custom game is still being set up

  Rule: A returning person sees the current choices and result

    @regression:custom-game-reconnect-read-before-settlement
    Scenario: A returning participant sees the custom game that started while he was offline
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      And Bob is offline
      And Alice has started the custom game
      When the connection comes back
      Then Bob sees the custom game under way with the first side to move

    @regression:space-join-preview-grants-stale
    @regression:custom-game-reconnect-read-before-settlement
    Scenario: A returning participant cannot revive a finished custom game
      Given Alice and Bob have a custom game under way
      And Bob is offline
      And Alice has resigned the custom game
      When the connection comes back
      Then Bob sees the finished custom game
      And Bob cannot make a move

  Rule: Acknowledged choices survive closing the app

    Scenario: A bot choice is kept after reopening
      Given Alice is setting up a custom game
      And Alice has assigned a bot to the second side
      When Alice closes and reopens the app
      Then the second side is a bot

    Scenario: An earlier choice cannot overwrite a newer set-up
      Given Alice is setting up a custom game
      And the second side has since been replaced by a bot
      When Alice opens the second side with the earlier set-up
      Then Alice is told the custom game's set-up has changed
      And the second side is a bot
