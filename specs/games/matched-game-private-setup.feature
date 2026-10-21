@domain:games
Feature: Private setups in a matched game
  When two people are paired for a game with a private setup, each wants to choose theirs in secret before the first move is due, so neither learns the other's and nobody waits for ever. It holds for every game with a private setup that offers finding an opponent.

  Rule: Each person chooses a complete private setup once, and a chosen private setup is final

    Background:
      Given Alice has the first side against Bob in a 5+0 matched game awaiting both private setups

    Scenario: Choosing a complete private setup makes a person ready
      Given Alice has a complete private setup
      When Alice chooses her private setup
      Then Alice and Bob see Alice is ready

    Scenario: An incomplete private setup cannot be chosen
      Given Alice's private setup is incomplete
      When Alice chooses her private setup
      Then Alice is told her private setup is incomplete

    Scenario: A chosen private setup cannot change
      Given Alice has chosen her private setup
      When Alice changes her private setup
      Then Alice is told her chosen private setup is final
      And Alice's private setup is unchanged

  Rule: Each person and every watcher sees who is ready, never another person's private setup

    Background:
      Given Alice has the first side against Bob in a 5+0 matched game awaiting both private setups
      And Carol is a guest watching Alice's matched game

    Scenario: Choosing a private setup shows the other person and the watcher who is ready
      Given Alice has a complete private setup
      When Alice chooses her private setup
      Then Bob and Carol see Alice is ready

    Scenario: A watcher opening the matched game cannot see a chosen private setup
      Given Alice has chosen her private setup
      When Carol opens Alice's matched game
      Then Bob and Carol cannot see Alice's private setup

  Rule: The first side's 30 seconds for the first move begin once both people have chosen their private setups

    Scenario: The second choice of a private setup gives the first side the turn
      Given Alice has the first side against Bob in a 5+0 matched game awaiting both private setups
      And Bob has chosen his private setup
      And Alice has a complete private setup
      When Alice chooses her private setup
      Then it is Alice's turn

    Scenario: The first side still has time 29 seconds after both private setups were chosen
      Given Alice has the first side against Bob in a 5+0 matched game awaiting both private setups
      And Alice and Bob chose their private setups 60 seconds after they were paired
      When 29 seconds pass
      Then the matched game is still unfinished

    Scenario: The first side misses the first move 30 seconds after both private setups were chosen
      Given Alice has the first side against Bob in a 5+0 matched game awaiting both private setups
      And Alice and Bob chose their private setups 60 seconds after they were paired
      When 30 seconds pass
      Then both people see the matched game was aborted

  Rule: Both people have 2 minutes from pairing to choose their private setups, or a daily game's days per move

    Scenario: A private setup still being chosen after 119 seconds keeps the matched game
      Given Alice has the first side against Bob in a 5+0 matched game awaiting both private setups
      And Alice has chosen her private setup
      When 119 seconds pass
      Then the matched game is still unfinished

    Scenario: A private setup not chosen within 2 minutes aborts the matched game with no result
      Given Alice has the first side against Bob in a 5+0 matched game awaiting both private setups
      And Alice has chosen her private setup
      When 120 seconds pass
      Then both people see the matched game was aborted
      And neither person's blitz rating has changed

    Scenario: A daily game's private setup still being chosen after 23 hours keeps the daily game
      Given Alice has the first side against Bob in a daily game at 1 day per move awaiting both private setups
      And Alice has chosen her private setup
      When 23 hours pass
      Then the matched game is still unfinished

    Scenario: A daily game's private setup not chosen within its day aborts the daily game
      Given Alice has the first side against Bob in a daily game at 1 day per move awaiting both private setups
      And Alice has chosen her private setup
      When 1 day passes
      Then both people see the matched game was aborted

  Rule: Either person may abort the matched game while the private setups are being chosen

    Scenario: The second side aborts while choosing a private setup
      Given Alice has the first side against Bob in a 5+0 matched game awaiting both private setups
      And Alice has chosen her private setup
      When Bob aborts the matched game
      Then both people see the matched game was aborted

    Scenario: Aborting is refused once both people have chosen their private setups and made their first moves
      Given Alice has the first side against Bob in a 5+0 matched game awaiting both private setups
      And Alice and Bob have chosen their private setups and made their first moves
      When Alice aborts the matched game
      Then Alice is told the matched game can no longer be aborted
      And the matched game is still unfinished

  Rule: Every move shows both people and every watcher what it revealed, and nothing more of a private setup

    Background:
      Given Alice has the first side against Bob in a 5+0 matched game awaiting both private setups
      And Alice and Bob have chosen their private setups

    Scenario: A move shows what it revealed to the other person and a watcher
      Given Carol is a guest watching Alice's matched game
      When Alice makes her first move
      Then Bob and Carol see what Alice's first move revealed

    Scenario: A refused move reveals nothing of the other private setup
      When Alice makes a move the game refuses
      Then Alice is told that move is not allowed
      And Alice cannot see the rest of Bob's private setup

  Rule: After the matched game, each person still sees only their own private setup and what play revealed

    Background:
      Given Bob has resigned the matched game after their first moves

    Scenario: Reviewing a finished matched game shows a person their own private setup
      When Alice chooses the first move in the move list
      Then Alice sees her own private setup and what play revealed of Bob's

    Scenario: A watcher reviewing a finished matched game sees neither private setup
      Given Carol is a guest watching Alice's matched game
      When Carol chooses the first move in the move list
      Then Carol cannot see either private setup

  Rule: Choosing a private setup and every move need a connection

    Background:
      Given Alice has the first side against Bob in a 5+0 matched game awaiting both private setups

    Scenario: A person back online can choose their private setup
      Given Alice has a complete private setup
      And Alice is back online after her offline choice was refused
      When Alice chooses her private setup
      Then Alice and Bob see Alice is ready

    Scenario: An offline person cannot choose their private setup
      Given Alice has a complete private setup
      And Alice's phone is offline
      When Alice chooses her private setup
      Then Alice is told the game needs a connection

    Scenario: An offline person cannot make the first move after both private setups are chosen
      Given Alice and Bob have chosen their private setups
      And Alice's phone is offline
      When Alice makes her first move
      Then Alice is told the game needs a connection
