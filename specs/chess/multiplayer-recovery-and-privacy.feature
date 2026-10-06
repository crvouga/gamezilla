@domain:chess
Feature: Keep a multiplayer game after time away
  When a person goes away from their game, they want to find the accepted
  board and multiplayer result on return, so the game stays lasting within spaces.

  Rule: An offline device keeps its last known board and the game unfinished

    Scenario: An offline person cannot defer a move
      Given Alice has a new multiplayer game and her phone is offline
      When Alice plays e2 to e4 as a multiplayer move
      Then Alice is told multiplayer moves need a connection
      And Alice's phone keeps its last known multiplayer board

    Scenario: Returning after Bob's multiplayer move shows the accepted board
      Given Alice's phone was offline when Bob's multiplayer move e7 to e5 was accepted
      When Alice's phone comes back online for multiplayer chess
      Then Alice and Bob see the same multiplayer board with two moves
      And Alice has the multiplayer turn

    Scenario: Returning after Bob resigns shows the accepted multiplayer result
      Given Alice's phone was offline when Bob resigned multiplayer chess
      When Alice's phone comes back online for multiplayer chess
      Then Alice sees she won the multiplayer game

    Scenario: Disconnecting does not give up the game
      Given Alice has an unfinished multiplayer game with Bob
      When Alice's phone loses its multiplayer connection
      Then Alice and Bob keep the unfinished multiplayer game

  Rule: Only people in either space can see the game and only matched people can act

    Scenario: A matched person opens their board
      Given Alice has an unfinished multiplayer game with Bob
      When Alice opens multiplayer chess
      Then Alice sees her multiplayer board and Bob's name

    Scenario: Another person cannot open the game
      Given Alice has an unfinished multiplayer game with Bob
      When Carol opens Alice's multiplayer game
      Then Carol is told no multiplayer game is available to her

    Scenario: Another person cannot move in the game
      Given Alice has an unfinished multiplayer game with Bob
      When Carol plays e2 to e4 in Alice's multiplayer game
      Then Carol is told no multiplayer game is available to her
      And Alice and Bob keep the same multiplayer board

  Rule: Confirmed account deletion stops searching, aborts a game not yet begun and otherwise gives up unfinished play

    Scenario: Deleting an account removes its opponent search
      Given Alice is looking for a chess opponent
      When Alice confirms account deletion
      Then Alice is not looking for a chess opponent
      And Bob cannot be matched with Alice's deleted account

    Scenario: Deleting an account before both first moves aborts the game
      Given Alice is White and Bob is Black in a new 5+0 multiplayer game
      When Alice confirms account deletion
      Then Bob sees the multiplayer game was aborted
      And neither person's blitz rating has moved

    Scenario: Deleting an account preserves the other person's multiplayer result
      Given Alice is White and Bob is Black in a 5+0 multiplayer game after e4 and e5
      When Alice confirms account deletion
      Then Bob sees he won the multiplayer game
      And Bob is not shown Alice's deleted personal details
