@domain:chess
Feature: Keep the game through disconnection
  When a person loses the connection, they want their agreed game kept and the current game on return, so old choices cannot take over after others have moved on.

  Rule: Choices involving another person need a connection and refused choices never happen later

    Scenario: Returning allows a fresh claim
      Given Alice has a configuring Custom Game
      And Bob is in Alice's space
      And Bob has returned online after an offline claim was refused
      When Bob claims Black in the Custom Game
      Then Black is Bob in the Custom Game

    Scenario: An offline claim does not reserve a side
      Given Alice has a configuring Custom Game
      And Bob is in Alice's space
      And Bob is offline
      When Bob claims Black in the Custom Game
      Then Bob is told Custom Games need a connection
      And Black is an open place in the Custom Game

    Scenario: An offline start cannot launch later
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      And Alice is offline
      When Alice starts the Custom Game
      Then Alice is told Custom Games need a connection
      And The Custom Game remains configuring

  Rule: The host can create and play a Custom Game without another person while offline
    No counter-example: the first rule covers choices involving another person.

    @regression:custom-game-offline-create-refused
    Scenario: An offline-created space can have a Custom Game
      Given Alice is hosting a space created offline
      When Alice creates a Custom Game
      Then Alice is the creator of the Custom Game
      And White is Alice and Black is an open place in the Custom Game

    Scenario: The host can choose a bot while offline
      Given Alice has a configuring Custom Game
      And Alice is offline
      When Alice assigns a bot to Black in the Custom Game
      Then Black is a bot in the Custom Game

    @regression:custom-game-offline-bot-stops
    Scenario: A bot answers the offline host's opening move
      Given Alice has an active Custom Game against a bot as Black
      And Alice is offline
      When Alice plays e2-e4 in the Custom Game
      Then A legal Black bot move follows within 5 seconds
      And White is to move in the Custom Game

    Scenario: Offline play survives reopening the app
      Given Alice has an active Custom Game against a bot as Black
      And Alice has played e2-e4 in the Custom Game while offline
      When Alice closes and reopens the app
      Then The Custom Game move list shows e4 once
      And White is to move in the Custom Game

    Scenario: Returning keeps the offline moves without playing them twice
      Given Alice has an active Custom Game against a bot as Black
      And Alice has played e2-e4 in the Custom Game while offline
      When the connection comes back
      Then The Custom Game move list shows e4 once
      And White is to move in the Custom Game

  Rule: A returning person sees the current choices and outcome

    Scenario: A returning watcher sees the game that started while they were away
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      And Bob is offline
      And Alice has started the Custom Game
      When the connection comes back
      Then Bob sees the active Custom Game with White to move

    @regression:space-join-preview-grants-stale
    Scenario: A returning participant cannot revive a completed game
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Bob is offline
      And Alice has resigned the Custom Game
      When the connection comes back
      Then Bob sees the completed Custom Game
      And Bob cannot move pieces in the Custom Game

  Rule: Acknowledged choices survive closing the app

    Scenario: A bot choice is kept after reopening
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is a bot
      When Alice closes and reopens the app
      Then Black is a bot in the Custom Game

    Scenario: An earlier choice cannot overwrite a newer configuration
      Given Alice has a configuring Custom Game
      And Black has since been replaced by a bot
      When Alice opens Black using earlier Custom Game choices
      Then Alice is told the Custom Game choices have changed
      And Black is a bot in the Custom Game
