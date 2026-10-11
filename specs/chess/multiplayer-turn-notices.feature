@domain:chess
Feature: Turn notices for daily games
  When it becomes a person's turn in their daily game, they want a
  turn notice in their inbox, so they know it is their move without keeping
  multiplayer chess open for days.

  Rule: The two people of a daily game, and nobody else, get a turn notice naming their multiplayer opponent when it becomes their turn

    Scenario: White gets a turn notice when the daily game starts, and Black gets none
      Given Alice and Bob are looking for 3 days per move chess opponents
      When a matchmaking match is formed for Alice and Bob
      Then White's inbox shows a turn notice for their daily game with Black within 15 seconds
      And Black's inbox still shows no turn notice after 15 seconds

    Scenario: A turn notice arrives in the inbox when the multiplayer opponent's move is accepted
      Given Alice is White and Bob is Black in a new daily game at 3 days per move
      And Bob is viewing their inbox
      When Alice plays e2 to e4 as a multiplayer move
      Then Bob's inbox shows a turn notice for their daily game with Alice within 15 seconds

    Scenario: A turn notice names the multiplayer opponent by their current username
      Given Alice is White and Bob is Black in a new daily game at 3 days per move
      And Alice has renamed themselves to @alice_atlas
      When Alice plays e2 to e4 as a multiplayer move
      Then Bob's turn notice names @alice_atlas as their multiplayer opponent

    Scenario: A move that ends the daily game brings no turn notice
      Given Alice is White and Bob is Black in a daily game at 3 days per move after f3, e5 and g4
      When Bob plays d8 to h4 as a multiplayer move
      Then both people see Bob won the multiplayer game by checkmate
      And Alice's inbox still shows no turn notice after 15 seconds

    Scenario: A multiplayer game that is not a daily game brings no turn notice
      Given Alice is White and Bob is Black in a new 5+0 multiplayer game
      When Alice plays e2 to e4 as a multiplayer move
      Then Bob's inbox still shows no turn notice after 15 seconds

    Scenario: A watcher gets no turn notice
      Given Alice is White and Bob is Black in a new daily game at 3 days per move
      And Carol is signed in
      And Carol is in Alice's space
      When Alice plays e2 to e4 as a multiplayer move
      Then Carol's inbox still shows no turn notice after 15 seconds

  Rule: A person's next turn in a daily game brings their one turn notice back unread
    No counter-example: a person's turn notice leaves the inbox when their own move is accepted, so nothing they or their multiplayer opponent do leaves two of them there.

    Scenario: A turn notice opened on an earlier turn is unread again on the next turn
      Given Alice is White and Bob is Black in a daily game at 3 days per move after e4 and e5
      And Bob opened their turn notice before playing e5
      When Alice plays g1 to f3 as a multiplayer move
      Then Bob's inbox shows one unread turn notice for their daily game with Alice within 15 seconds

  Rule: A turn notice leaves the inbox as soon as the person's own move is accepted, or the daily game is over or aborted

    Scenario: A person's own accepted move takes their turn notice away
      Given Alice is White and Bob is Black in a new daily game at 3 days per move
      When Alice plays e2 to e4 as a multiplayer move
      Then Alice's inbox stops showing the turn notice for their daily game with Bob within 15 seconds

    Scenario: A daily game that is over takes the turn notice away
      Given Alice is White and Bob is Black in a daily game at 3 days per move after e4 and e5
      When Bob resigns multiplayer chess
      Then Alice's inbox stops showing the turn notice for their daily game with Bob within 15 seconds

    Scenario: An aborted daily game takes the turn notice away
      Given Alice is White and Bob is Black in a new daily game at 3 days per move
      When Bob aborts the multiplayer game
      Then Alice's inbox stops showing the turn notice for their daily game with Bob within 15 seconds

    Scenario: A refused move keeps the turn notice and brings the multiplayer opponent none
      Given Alice is White and Bob is Black in a new daily game at 3 days per move
      When Alice plays e2 to e5 as a multiplayer move
      Then Alice is told that multiplayer move is illegal
      And Alice's inbox still shows one turn notice for their daily game with Bob after 15 seconds
      And Bob's inbox still shows no turn notice after 15 seconds

  Rule: Opening a turn notice takes the person to multiplayer chess in their own space, creating a space when they host none

    Background:
      Given Alice is White and Bob is Black in a new daily game at 3 days per move

    Scenario: Opening a turn notice shows the daily game in the space the person hosts
      Given Alice is hosting a space
      When Alice opens their turn notice
      Then Alice sees her multiplayer board and Bob's name
      And Alice hosts 1 space

    Scenario: Opening a turn notice creates a space for a person who hosts none
      Given Alice has ended the space
      When Alice opens their turn notice
      Then Alice hosts 1 space
      And Alice sees her multiplayer board and Bob's name

    Scenario: Opening a turn notice does not make the move
      Given Alice is hosting a space
      When Alice opens their turn notice
      Then Alice's inbox still shows one turn notice for their daily game with Bob after 15 seconds
      And Alice's turn notice is no longer unread

    Scenario: Opening a turn notice while offline shows the last known multiplayer board and leaves it unread
      Given Alice's phone is offline
      When Alice opens their turn notice
      Then Alice's phone keeps its last known multiplayer board
      And Alice's inbox still shows one unread turn notice for their daily game with Bob after 15 seconds

  Rule: A person who was not using the app finds their turn notice when they are back

    Scenario: A person whose phone was offline finds their turn notice once it is back online
      Given Bob's phone was offline when Alice's first move in their daily game at 3 days per move was accepted
      When Bob's phone comes back online for multiplayer chess
      Then Bob's inbox shows a turn notice for their daily game with Alice within 15 seconds

    Scenario: A person whose app was closed finds their turn notice when they reopen it
      Given Bob's app was closed when Alice's first move in their daily game at 3 days per move was accepted
      When Bob reopens the app
      Then Bob's inbox shows a turn notice for their daily game with Alice within 15 seconds

    Scenario: A person who is offline does not see a new turn notice yet
      Given Alice is White and Bob is Black in a new daily game at 3 days per move
      And Bob is offline
      When Alice plays e2 to e4 as a multiplayer move
      Then Bob's inbox still shows no turn notice after 15 seconds
