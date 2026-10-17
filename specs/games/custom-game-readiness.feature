@domain:games
Feature: Become ready and start a custom game
  When the participants have set up a custom game, its creator wants to start it only after they agree, so nobody begins with a missing participant or a set-up they did not see.

  Rule: Every person in the custom game is ready for its current set-up

    Scenario: The second person makes a complete game startable
      Given Alice is setting up a custom game with Bob on the second side
      And Alice is ready for the custom game
      When Bob becomes ready for the custom game
      Then the custom game can start

    Scenario: A watcher cannot become ready for a participant
      Given Alice is setting up a custom game with Bob on the second side
      And Carol is in Alice's space
      When Carol becomes ready for the custom game
      Then Carol is told she is not a participant

  Rule: After the set-up changes, every person must become ready again

    Scenario: A clock choice requires renewed agreement
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      When Alice chooses 5+2 for the custom game
      Then neither person is ready for the custom game
      And the custom game is played at 5+2

    Scenario: A participant who is no longer ready stops the start
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      And Bob is no longer ready for the custom game
      When Alice starts the custom game
      Then Alice is told every person must be ready

  Rule: Only the creator starts a complete custom game everyone in it is ready for

    Scenario: Ready participants start one game
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      When Alice starts the custom game
      Then the custom game is under way with the first side to move

    Scenario: An invitation prevents start
      Given Alice is setting up a custom game
      And Alice has invited Bob to the second side
      And Alice is ready for the custom game
      When Alice starts the custom game
      Then Alice is told both sides need participants

    Scenario: A participant cannot start instead of the creator
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      When Bob starts the custom game
      Then Bob is told only the creator starts the custom game

  Rule: Starting again never restarts the same custom game

    Scenario: Repeating an acknowledged start keeps the current board
      Given Alice and Bob have a custom game under way
      When Alice starts the custom game
      Then the custom game remains under way with no new game

    Scenario: A finished game cannot restart
      Given Alice has a finished custom game
      When Alice starts the custom game
      Then Alice is told the game is finished

    Scenario: A cancelled game cannot restart
      Given Alice has a cancelled custom game
      When Alice starts the custom game
      Then Alice is told the custom game was cancelled

  Rule: A start uses the set-up the participants agreed to

    Scenario: Two starts produce one game
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      When Alice starts the custom game twice at the same time
      Then the custom game remains under way with no new game

    Scenario: A stale start cannot bypass a changed set-up
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      And the custom game's set-up changed before Alice's start
      When Alice starts the custom game with the earlier set-up
      Then Alice is told the custom game's set-up has changed

  Rule: A person may withdraw readiness until the custom game starts

    Scenario: A ready person withdraws their agreement
      Given Alice is setting up a custom game with Bob on the second side
      And Alice and Bob are ready for the custom game
      When Bob withdraws readiness for the custom game
      Then Bob is not ready for the custom game
      And the custom game cannot start

    Scenario: Readiness cannot be withdrawn after start
      Given Alice and Bob have a custom game under way
      When Bob withdraws readiness for the custom game
      Then Bob is told the custom game has already started
