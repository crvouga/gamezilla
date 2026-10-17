@domain:games
Feature: Turn notices for daily games
  When it becomes a person's turn in their daily game, they want a turn notice in their inbox, so they know it is their move without keeping finding an opponent open for days.

  Rule: The two people of a daily game, and nobody else, get a turn notice naming their opponent when it becomes their turn

    Scenario: The first side gets a turn notice when the daily game starts, and the second side gets none
      Given Alice and Bob are seeking an opponent for the game at 3 days per move
      When they are paired
      Then the first side's inbox shows a turn notice for their daily game with the second side within 15 seconds
      And the second side's inbox still shows no turn notice after 15 seconds

    Scenario: A turn notice arrives in the inbox when the opponent's move is accepted
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      And Bob is viewing their inbox
      When Alice makes her first move
      Then Bob's inbox shows a turn notice for their daily game with Alice within 15 seconds

    Scenario: A turn notice names the opponent by their current username
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      And Alice has renamed themselves to @alice_atlas
      When Alice makes her first move
      Then Bob's turn notice names @alice_atlas as their opponent

    Scenario: A move that ends the daily game brings no turn notice
      Given Alice has the first side against Bob in a daily game at 3 days per move one move from her victory
      When Alice makes the winning move
      Then both people see Alice won the matched game
      And Bob's inbox still shows no turn notice after 15 seconds

    Scenario: A matched game that is not a daily game brings no turn notice
      Given Alice has the first side against Bob in a new 5+0 matched game
      When Alice makes her first move
      Then Bob's inbox still shows no turn notice after 15 seconds

    Scenario: A watcher gets no turn notice
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      And Carol is signed in
      And Carol is in Alice's space
      When Alice makes her first move
      Then Carol's inbox still shows no turn notice after 15 seconds

  Rule: A person's next turn in a daily game brings their one turn notice back unread
    No counter-example: a person's turn notice leaves the inbox when their own move is accepted, so nothing they or their opponent do leaves two of them there.

    Scenario: A turn notice opened on an earlier turn is unread again on the next turn
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves
      And Bob opened his turn notice before making his first move
      When Alice makes her move
      Then Bob's inbox shows one unread turn notice for their daily game with Alice within 15 seconds

  Rule: A turn notice leaves the inbox as soon as the person's own move is accepted, or the daily game is over or aborted

    Scenario: A person's own accepted move takes their turn notice away
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      When Alice makes her first move
      Then Alice's inbox stops showing the turn notice for their daily game with Bob within 15 seconds

    Scenario: A daily game that is over takes the turn notice away
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves
      When Bob resigns the matched game
      Then Alice's inbox stops showing the turn notice for their daily game with Bob within 15 seconds

    Scenario: An aborted daily game takes the turn notice away
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      When Bob aborts the matched game
      Then Alice's inbox stops showing the turn notice for their daily game with Bob within 15 seconds

    Scenario: A refused move keeps the turn notice and brings the opponent none
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      When Alice makes a move the game refuses
      Then Alice is told that move is not allowed
      And Alice's inbox still shows one turn notice for their daily game with Bob after 15 seconds
      And Bob's inbox still shows no turn notice after 15 seconds

  Rule: Opening a turn notice takes the person to finding an opponent in their own space, creating a space when they host none

    Background:
      Given Alice has the first side against Bob in a new daily game at 3 days per move

    Scenario: Opening a turn notice shows the daily game in the space the person hosts
      Given Alice is hosting a space
      When Alice opens their turn notice
      Then Alice sees her board and Bob as her opponent
      And Alice hosts 1 space

    Scenario: Opening a turn notice creates a space for a person who hosts none
      Given Alice has ended the space
      When Alice opens their turn notice
      Then Alice hosts 1 space
      And Alice sees her board and Bob as her opponent

    Scenario: Opening a turn notice does not make the move
      Given Alice is hosting a space
      When Alice opens their turn notice
      Then Alice's inbox still shows one turn notice for their daily game with Bob after 15 seconds
      And Alice's turn notice is no longer unread

    Scenario: Opening a turn notice while offline shows the last known board and leaves it unread
      Given Alice's phone is offline
      When Alice opens their turn notice
      Then Alice's phone keeps its last known board
      And Alice's inbox still shows one unread turn notice for their daily game with Bob after 15 seconds

  Rule: A person who was not using the app finds their turn notice when they are back

    Scenario: A person whose phone was offline finds their turn notice once it is back online
      Given Bob's phone was offline when Alice's first move in their daily game at 3 days per move was accepted
      When the connection comes back
      Then Bob's inbox shows a turn notice for their daily game with Alice within 15 seconds

    Scenario: A person whose app was closed finds their turn notice when they reopen it
      Given Bob's app was closed when Alice's first move in their daily game at 3 days per move was accepted
      When Bob reopens the app
      Then Bob's inbox shows a turn notice for their daily game with Alice within 15 seconds

    Scenario: A person who is offline does not see a new turn notice yet
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      And Bob is offline
      When Alice makes her first move
      Then Bob's inbox still shows no turn notice after 15 seconds
