@domain:games
Feature: Result notices for daily games
  When a daily game ends while a person is not looking at it, they want a result notice in their inbox, so they find out how it ended for them the next time they use the app.

  Rule: When a daily game is over, its two people, and nobody else, get a result notice saying whether it was won, lost or drawn for them, and why

    Scenario: Running out of time leaves both people a result notice
      Given Alice has the first side against Bob in a daily game at 1 day per move after their first moves
      When 1 day passes
      Then Bob's inbox shows within 15 seconds a result notice of a daily game won against Alice by the first side running out of time
      And Alice's inbox shows within 15 seconds a result notice of a daily game lost against Bob by the first side running out of time

    Scenario: The winning move leaves both people a result notice
      Given Alice has the first side against Bob in a daily game at 3 days per move one move from her victory
      When Alice makes the winning move
      Then Alice's inbox shows within 15 seconds a result notice of a daily game won against Bob by the game's own rules
      And Bob's inbox shows within 15 seconds a result notice of a daily game lost against Alice by the game's own rules

    Scenario: Resigning leaves both people a result notice
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves
      When Bob resigns the matched game
      Then Alice's inbox shows within 15 seconds a result notice of a daily game won against Bob by resignation
      And Bob's inbox shows within 15 seconds a result notice of a daily game lost against Alice by resignation

    Scenario: A daily game drawn by agreement leaves both people a result notice
      Given Alice has offered Bob a draw in their daily game at 3 days per move
      When Bob accepts the draw
      Then Alice's inbox shows within 15 seconds a result notice of a daily game drawn against Bob by agreement
      And Bob's inbox shows within 15 seconds a result notice of a daily game drawn against Alice by agreement

    Scenario: An unfinished daily game leaves no result notice
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      When Alice makes her first move
      Then Alice's inbox still shows no result notice after 15 seconds

    Scenario: A matched game that is not a daily game leaves no result notice
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Bob resigns the matched game
      Then Alice's inbox still shows no result notice after 15 seconds

    Scenario: A watcher gets no result notice
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves
      And Carol is signed in
      And Carol is in Alice's space
      When Bob resigns the matched game
      Then Carol's inbox still shows no result notice after 15 seconds

  Rule: When a daily game is aborted, both of its people get a result notice saying so

    Scenario: Aborting a daily game leaves both people a result notice
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      When Bob aborts the matched game
      Then Alice's inbox shows within 15 seconds a result notice of an aborted daily game against Bob
      And Bob's inbox shows within 15 seconds a result notice of an aborted daily game against Alice

    Scenario: Missing the first move leaves both people a result notice of an aborted daily game
      Given Alice has the first side against Bob in a new daily game at 1 day per move
      When 1 day passes
      Then Alice's inbox shows within 15 seconds a result notice of an aborted daily game against Bob
      And Bob's inbox shows within 15 seconds a result notice of an aborted daily game against Alice

    Scenario: A daily game that can no longer be aborted leaves no result notice
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves
      When Alice aborts the matched game
      Then Alice is told the matched game can no longer be aborted
      And Alice's inbox still shows no result notice after 15 seconds

  Rule: A result notice stays in the inbox until its person dismisses it, which needs a connection

    Background:
      Given Alice has a result notice of a daily game won against Bob

    Scenario: Dismissing a result notice takes it out of the inbox
      When Alice dismisses her result notice
      Then Alice's inbox stops showing the result notice of their daily game against Bob within 15 seconds

    Scenario: Dismissing a result notice leaves the opponent's result notice in place
      When Alice dismisses her result notice
      Then Bob's inbox still shows the result notice of their daily game against Alice after 15 seconds

    Scenario: A result notice is still there when the person reopens the app
      Given Alice has closed the app
      When Alice reopens the app
      Then Alice's inbox still shows the result notice of their daily game against Bob after 15 seconds

    Scenario: A result notice is still there after the person finds a new opponent
      When Alice finds a new opponent
      Then Alice's inbox still shows the result notice of their daily game against Bob after 15 seconds

    Scenario: An offline person cannot dismiss a result notice
      Given Alice's phone is offline
      When Alice dismisses her result notice
      Then Alice is told the game needs a connection
      And Alice's inbox still shows the result notice of their daily game against Bob after 15 seconds

  Rule: Opening a result notice takes the person to finding an opponent in their own space, creating a space when they host none

    Background:
      Given Alice has a result notice of a daily game won against Bob

    Scenario: Opening a result notice shows the finished daily game in the space the person hosts
      Given Alice is hosting a space
      When Alice opens her result notice
      Then Alice sees she won the matched game
      And Alice hosts 1 space

    Scenario: Opening a result notice creates a space for a person who hosts none
      Given Alice has ended the space
      When Alice opens her result notice
      Then Alice hosts 1 space
      And Alice sees she won the matched game

    Scenario: Opening a result notice does not dismiss it
      Given Alice is hosting a space
      When Alice opens her result notice
      Then Alice's inbox still shows the result notice of their daily game against Bob after 15 seconds

    Scenario: Opening a result notice while offline shows the last known board
      Given Alice's phone is offline
      When Alice opens her result notice
      Then Alice's phone keeps its last known board
      And Alice's inbox still shows the result notice of their daily game against Bob after 15 seconds

  Rule: A person who was not using the app finds their result notice when they are back

    Scenario: A person whose phone was offline finds their result notice once it is back online
      Given Alice's phone was offline when Bob resigned their daily game at 3 days per move
      When the connection comes back
      Then Alice's inbox shows within 15 seconds a result notice of a daily game won against Bob by resignation

    Scenario: A person whose app was closed finds their result notice when they reopen it
      Given Alice's app was closed when Bob resigned their daily game at 3 days per move
      When Alice reopens the app
      Then Alice's inbox shows within 15 seconds a result notice of a daily game won against Bob by resignation

    Scenario: A person who is offline does not see a new result notice yet
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves
      And Alice is offline
      When Bob resigns the matched game
      Then Alice's inbox still shows no result notice after 15 seconds
