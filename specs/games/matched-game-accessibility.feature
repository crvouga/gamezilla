@domain:games
Feature: Matched games with the keyboard alone and by listening
  When a person uses only the keyboard or listens to the app, they want to find an opponent and play, so every part of a matched game is open to them.

  Rule: Finding an opponent and the matched game work with the keyboard alone
    No counter-example: keyboard access is always available, whatever the matched game's result.

    Scenario: A person using the keyboard alone can seek an opponent
      Given Alice has an account and is using the keyboard alone
      When Alice seeks an opponent for the game at 5+0 with the keyboard alone
      Then Alice is waiting for an opponent at 5+0

    Scenario: A person using the keyboard alone can resign
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves and is using the keyboard alone
      When Alice resigns the matched game with the keyboard alone
      Then both people see Bob won the matched game

    Scenario: A person using the keyboard alone can abort a new matched game
      Given Alice has the first side against Bob in a new matched game and is using the keyboard alone
      When Alice aborts the matched game with the keyboard alone
      Then both people see the matched game was aborted

    Scenario: A person using the keyboard alone can offer a draw
      Given Alice has the first side against Bob in a new matched game and is using the keyboard alone
      When Alice offers a draw with the keyboard alone
      Then Bob is offered a draw

    Scenario: A person using the keyboard alone can offer a rematch
      Given Alice is using the keyboard alone after her 5+0 matched game with Bob is finished
      When Alice offers a rematch with the keyboard alone
      Then Bob is offered a rematch

  Rule: A listener hears who they were paired with, the matched game, both clocks, offers and the result
    No counter-example: descriptions and announcements are always there for a listener.

    @regression:matched-accessibility-clock-copy-prefix
    Scenario: A listener hears who they were paired with
      Given Alice is listening to the app while seeking an opponent for the game at 3+2
      And Bob is seeking an opponent for the game at 3+2
      When they are paired
      Then Alice hears she was paired with Bob, his blitz rating, the clock choice and her side

    Scenario: A listener hears their side and the person whose turn it is
      Given Alice has the first side against Bob in a new matched game and is listening to the app
      When Alice opens finding an opponent
      Then Alice hears she has the first side and the turn
      And Alice hears what every control of the matched game does

    Scenario: A listener hears the time left on both clocks
      Given Alice is listening to her unfinished matched game with Bob
      When Alice opens finding an opponent
      Then Alice hears the time left on both clocks

    Scenario: A listener hears a draw offer
      Given Alice is listening to her unfinished matched game with Bob
      When Bob offers a draw
      Then Alice hears Bob offered her a draw

    Scenario: A listener hears that the matched game was aborted
      Given Alice has the first side against Bob in a new matched game and is listening to the app
      When Bob aborts the matched game
      Then Alice hears the matched game was aborted

    Scenario: A listener hears a rematch offer
      Given Alice is listening to the app after her 5+0 matched game with Bob is finished
      When Bob offers a rematch
      Then Alice hears Bob offered her a rematch

    Scenario: A listener hears the result
      Given Alice is listening to her 5+0 matched game with Bob after their first moves
      When Bob resigns the matched game
      Then Alice hears she won the matched game
