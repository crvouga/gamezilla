@domain:games
Feature: Returning to their game
  When a person has an unfinished game and finds themselves somewhere else in the app, they want to get back to its board in one step, so wandering off never leaves them stuck in front of something they cannot start.

  Rule: While a game session is under way in a space, the space stays on its board

    @regression:finish-game-session-first-dead-end
    Scenario: Opening finding an opponent during a game session keeps everyone on its board
      Given Alice and Bob have a game session under way watched by Carol
      When Alice opens finding an opponent
      Then Alice and Bob see the same board and turn
      And Alice is not offered to seek an opponent

    Scenario: The host is not offered going back to the game choice during a game session
      Given Alice and Bob have a game session under way
      When Alice goes back from the game's choices to the game choice
      Then Alice is not offered to go back to the game choice
      And Alice and Bob see the same board and turn

    Scenario: A watcher who joins during a game session is shown its board
      Given Alice and Bob have a game session under way
      And Carol is a guest
      When Carol joins Alice's space
      Then Carol and Alice see the same board and turn
      And Carol cannot make a move

    Scenario: A host who returns to their space during a game session is shown its board
      Given Alice and Bob have a game session under way
      And Alice has gone back to the lobby
      When Alice returns to their space
      Then Alice and Bob see the same board and turn

    Scenario: Once the game session is finished the host takes the space back to the game choice
      Given Alice has a finished game session
      When Alice goes back from the game's choices to the game choice
      Then Alice sees the space's game choice

  Rule: A participant of a game session under way is offered to return to the game session wherever they are, on every device

    Scenario: A participant who goes back to the lobby is offered to return to the game session
      Given Alice and Bob have a game session under way
      When Bob goes back to the lobby
      Then Bob is offered to return to the game session

    Scenario: Returning to the game session from the lobby shows its board in one step
      Given Alice and Bob have a game session under way
      And Bob has gone back to the lobby
      When Bob returns to the game session
      Then Alice and Bob see the same board and turn

    Scenario: A participant who reopens the app outside the space is offered to return to the game session
      Given Alice and Bob have a game session under way
      And Alice has gone back to the lobby
      When Alice closes and reopens the app
      Then Alice is offered to return to the game session

    Scenario: A participant's other device is offered to return to the game session
      Given Alice and Bob have a game session under way
      And Alice is also signed in on another device
      When Alice goes back to the lobby on her other device
      Then Alice is offered to return to the game session on her other device

    Scenario: A watcher has no game session to return to
      Given Alice and Bob have a game session under way watched by Carol
      When Carol goes back to the lobby
      Then Carol is not offered to return to the game session

    Scenario: Nobody is offered to return to a finished game session
      Given Alice has a finished game session
      When Alice goes back to the lobby
      Then Alice is not offered to return to the game session

  Rule: A person with an unfinished matched game is offered to return to their game wherever they are, on every device

    Scenario: Returning to the matched game from the lobby shows its board in one step
      Given Alice has an unfinished matched game with Bob
      And Alice has gone back to the lobby
      When Alice returns to her matched game
      Then Alice sees her board and Bob as her opponent

    Scenario: Another device of the person is offered to return to the matched game
      Given Alice has an unfinished matched game with Bob
      And Alice is also signed in on another device
      When Alice goes back to the lobby on her other device
      Then Alice is offered to return to her matched game on her other device

    Scenario: A daily game is waiting after the host takes the space to another game
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves
      And Alice has picked another game for the space
      When Alice returns to her matched game
      Then Alice sees her board and Bob as her opponent

    Scenario: Nobody is offered to return to a matched game that is over
      Given Alice's matched game with Bob is finished
      When Alice goes back to the lobby
      Then Alice is not offered to return to her matched game

  Rule: While a person has an unfinished game, seeking an opponent is never offered, and they are offered to return to their game in its place

    Scenario: A person with an unfinished matched game is offered to return to the matched game instead of seeking for another game
      Given Alice has an unfinished matched game with Bob
      When Alice opens finding an opponent for another game
      Then Alice is not offered to seek an opponent
      And Alice is offered to return to her matched game

    Scenario: A person whose matched game is over is offered seeking for another game again
      Given Alice's matched game with Bob is finished
      When Alice opens finding an opponent for another game
      Then Alice is offered to seek an opponent
      And Alice is not offered to return to her matched game

    Scenario: A participant of a game session is offered to return to the game session instead of seeking from his own space
      Given Alice and Bob have a game session under way
      And Bob is hosting a space on his other device
      When Bob opens finding an opponent on his other device
      Then Bob is not offered to seek an opponent on his other device
      And Bob is offered to return to the game session on his other device

  Rule: Going back from the board returns a person to their previous place in the space and asks a participant before ending play

    @regression:game-stage-back-minimizes-space
    Scenario: Going back from a game session against a bot asks before resigning
      Given Alice has a game session under way against a bot
      When Alice goes back from the board
      Then Alice is offered to resign or keep playing
      And the game session is under way

    Scenario: A participant who stays keeps the same game
      Given Alice and Bob have a game session under way
      And Alice has been asked whether to resign on her way back
      When Alice chooses to keep playing
      Then Alice and Bob see the same board and turn

    Scenario: A participant who confirms goes back to the choices the board opened from
      Given Alice and Bob have a game session under way
      And Alice has been asked whether to resign on her way back
      When Alice confirms her resignation
      Then Alice is shown the game's choices within 15 seconds

    Scenario: A watcher goes back without interrupting the participants
      Given Alice and Bob have a game session under way watched by Carol
      When Carol goes back from the board
      Then Carol is shown the game's choices within 15 seconds
      And Alice and Bob see the same board and turn

    Scenario: A person going back before a matched game begins can call it off
      Given Alice has the first side against Bob in a new matched game
      When Alice goes back from the board
      Then Alice is offered to abort or keep playing
      And the matched game is still unfinished

    Scenario: A person going back after both first moves can resign the matched game
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Alice goes back from the board
      Then Alice is offered to resign or keep playing
      And the matched game is still unfinished
