@domain:games
Feature: Private setups in a custom game
  When a custom game is of a game with a private setup, each person wants to prepare theirs in secret and confirm it before the start, so nobody begins with an incomplete private setup or learns anyone else's. It holds for every game with a private setup that offers custom games.

  Rule: Only a complete private setup can be ready, and becoming ready confirms it

    Background:
      Given Alice is setting up a custom game with Bob on the second side

    Scenario: A complete private setup lets a person become ready
      Given Bob has a complete private setup
      When Bob becomes ready for the custom game
      Then Bob is ready for the custom game

    Scenario: An incomplete private setup cannot become ready
      Given Bob's private setup is incomplete
      When Bob becomes ready for the custom game
      Then Bob is told his private setup is incomplete
      And Bob is not ready for the custom game

  Rule: A private setup can change only while its person is not ready and the custom game is being set up

    Scenario: A ready person cannot change their private setup
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      When Bob changes his private setup
      Then Bob is told his private setup cannot change while he is ready
      And Bob's private setup is unchanged

    Scenario: Withdrawing readiness lets a person change their private setup
      Given Alice is setting up a custom game with Bob on the second side
      And Bob is no longer ready for the custom game
      When Bob changes his private setup
      Then Bob sees his change to his private setup

    Scenario: A private setup cannot change once the custom game has started
      Given Alice and Bob have a custom game under way
      When Bob changes his private setup
      Then Bob is told the custom game has already started
      And Bob's private setup is unchanged

  Rule: Only its own person sees a private setup, and everyone sees who is ready

    Background:
      Given Alice is setting up a custom game with Bob on the second side
      And Carol is in Alice's space

    Scenario: Readiness is shown to everyone in the space
      Given Bob has a complete private setup
      When Bob becomes ready for the custom game
      Then Alice and Carol see Bob is ready

    Scenario: A person's change to their private setup reaches nobody else
      When Bob changes his private setup
      Then Alice and Carol cannot see Bob's private setup

    Scenario: A device without a connection does not show readiness until the connection comes back
      Given Bob has a complete private setup
      And Carol's phone is offline
      When Bob becomes ready for the custom game
      Then Carol does not see Bob is ready until the connection comes back

  Rule: The creator starts once every person is ready, and a bot prepares its private setup at the start

    Scenario: A bot has a complete private setup when the custom game starts
      Given Alice is ready for a custom game against a bot
      When Alice starts the custom game
      Then the custom game is under way with the first side to move
      And the second side's bot has a complete private setup

    Scenario: A person with an incomplete private setup keeps the custom game from starting
      Given Alice is setting up a custom game with Bob on the second side
      And Alice is ready for the custom game
      And Bob's private setup is incomplete
      When Alice starts the custom game
      Then Alice is told every person must be ready

  Rule: After play, each person still sees only their own private setup and what play revealed

    Background:
      Given Alice and Bob have a custom game after Alice's first move
      And Alice has resigned the custom game

    Scenario: The history shows a person their own private setup and what play revealed
      When Alice opens the game's history
      Then Alice sees her own private setup and what play revealed of Bob's

    Scenario: Someone in the space reviewing the finished custom game sees neither private setup
      Given Carol is in Alice's space
      When Carol reviews the starting position
      Then Carol cannot see either private setup

  Rule: A rematch starts with no private setups

    Scenario: A rematch needs new private setups
      Given Alice and Bob have a custom game under way
      And Alice has resigned the custom game
      When Alice asks for a rematch
      Then a new custom game is being set up with no moves
      And neither person has a private setup in the new custom game

    Scenario: An earlier private setup cannot make a person ready in the rematch
      Given Alice has asked for a rematch of her finished custom game with Bob
      When Bob becomes ready for the custom game
      Then Bob is told his private setup is incomplete

  Rule: With a private setup, becoming ready and starting need the connection, and a move against a bot shows no result until the connection returns

    Scenario: A person without a connection cannot become ready
      Given Alice is setting up a custom game with Bob on the second side
      And Bob has a complete private setup
      And Bob is offline
      When Bob becomes ready for the custom game
      Then Bob is told the game needs a connection

    Scenario: An offline host cannot start a custom game against a bot
      Given Alice is ready for a custom game against a bot
      And Alice is offline
      When Alice starts the custom game
      Then Alice is told the game needs a connection
      And the custom game is still being set up

    Scenario: A move made offline shows no result until the connection comes back
      Given Alice has a custom game under way against a bot
      And Alice is offline
      When Alice makes her move
      Then Alice's move shows no result until the connection comes back
      And the bot has not replied

    Scenario: A move made offline counts once the connection comes back
      Given Alice has a custom game under way against a bot
      And Alice has made her move while offline
      When the connection comes back
      Then the custom game keeps her move and the bot's reply
      And it is Alice's turn
