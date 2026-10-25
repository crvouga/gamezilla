@domain:games
Feature: A stand-in for someone away from a game with more than two sides
  When a participant of a custom game with more than two sides stays away, the others want play to go on without them, and the participant wants their side back when they return, so nobody is held up and nobody loses their side. It holds for every game with more than two sides that offers custom games.

  Rule: After 60 seconds away, a stand-in plays the participant's side, shown to everyone as their stand-in, while another person is in the custom game

    Scenario: A stand-in moves for a participant away for 60 seconds
      Given Alice, Bob, Carol and Dave have a four-player custom game with Bob to move
      And Bob has been away from the custom game for 59 seconds
      When a second passes
      Then Alice, Carol and Dave see a stand-in playing Bob's side
      And Bob's stand-in makes a move for Bob's side

    Scenario: A participant away for less than 60 seconds keeps the turn with no stand-in
      Given Alice, Bob, Carol and Dave have a four-player custom game with Bob to move
      And Bob has been away from the custom game for 30 seconds
      When 29 seconds pass
      Then Bob keeps the custom game turn
      And Bob's side still has no stand-in

    Scenario: A person alone with three bots gets no stand-in
      Given Alice has a four-player custom game against three bots with Alice to move
      And Alice has been offline for 59 seconds
      When a second passes
      Then Alice keeps the custom game turn
      And Alice's side still has no stand-in

  Rule: While a stand-in plays their side, the participant keeps it and their own moves are refused

    Scenario: A stand-in's last move finishes the custom game by the rules, and the participant keeps their side
      Given Alice, Bob, Carol and Dave have a four-player custom game one move from Carol's victory alone, with Dave to move
      And a stand-in is playing Dave's side
      When Dave's stand-in makes its move
      Then Carol wins the custom game
      And the finished custom game shows Dave on the fourth side

    Scenario: A participant's own move is refused while a stand-in plays their side
      Given Alice, Bob, Carol and Dave have a four-player custom game with Bob to move
      And a stand-in is playing Bob's side
      And Bob is back online
      When Bob makes his move
      Then Bob is told a stand-in plays his side until he takes back his side
      And the board and turn are unchanged

    Scenario: A participant's own secret choice is refused while a stand-in plays their side
      Given Alice, Bob, Carol and Dave have a four-player custom game awaiting secret choices
      And a stand-in is playing Bob's side
      And Bob is back online
      When Bob makes his secret choice
      Then Bob is told a stand-in plays his side until he takes back his side
      And Bob's secret choice is unchanged

  Rule: A participant back online can take back their side, and the stand-in then decides nothing for it

    Background:
      Given Alice, Bob, Carol and Dave have a four-player custom game with Alice to move

    Scenario: A participant taking back their side has the next turn of their side
      Given a stand-in is playing Bob's side
      And Bob is back online and has taken back his side
      When Alice makes her move
      Then Bob has the custom game turn
      And no stand-in plays Bob's side

    Scenario: Only the participant whose side a stand-in plays can take a side back
      Given a stand-in is playing Bob's side
      When Carol takes back her side
      Then Carol is told she is already playing her own side
      And a stand-in still plays Bob's side

    Scenario: A participant without a connection cannot take back their side
      Given a stand-in is playing Bob's side
      And Bob is offline
      When Bob takes back his side
      Then Bob is told the game needs a connection
      And a stand-in still plays Bob's side

    Scenario: A participant playing their own side has no side to take back
      When Bob takes back his side
      Then Bob is told he is already playing his own side
      And Bob still plays his own side

  Rule: A participant taking back their side sees nothing of another side they could not see before
    No counter-example: taking back a side never shows another side's secret choice or private setup.

    Scenario: A participant back from a stand-in sees only their own side's secret choice
      Given Alice, Bob, Carol and Dave have a four-player custom game awaiting secret choices
      And a stand-in is playing Bob's side and has made its secret choice
      And Alice has made her secret choice
      And Bob is back online
      When Bob takes back his side
      Then Bob sees his own secret choice
      And Bob cannot see Alice's secret choice
