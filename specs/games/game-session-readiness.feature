@domain:games
Feature: Become ready and start a game session
  When the participants have set up a game session, its creator wants to start it only after they agree, so nobody begins with a missing participant or a set-up they did not see.

  Rule: Every person in the game session is ready for its current set-up

    Scenario: The second person makes a complete game startable
      Given Alice is setting up a game session with Bob on the second side
      And Alice is ready for the game session
      When Bob becomes ready for the game session
      Then the game session can start

    Scenario: A watcher cannot become ready for a participant
      Given Alice is setting up a game session with Bob on the second side
      And Carol is in Alice's space
      When Carol becomes ready for the game session
      Then Carol is told she is not a participant

  Rule: After the set-up changes, every person must become ready again

    Scenario: A clock choice requires renewed agreement
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      When Alice chooses 5+2 for the game session
      Then neither person is ready for the game session
      And the game session is played at 5+2

    Scenario: A participant who is no longer ready stops the start
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      And Bob is no longer ready for the game session
      When Alice starts the game session
      Then Alice is told every person must be ready

  Rule: Only the creator starts a complete game session everyone in it is ready for

    Scenario: Ready participants start one game
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      When Alice starts the game session
      Then the game session is under way with the first side to move

    Scenario: An invitation prevents start
      Given Alice is setting up a game session
      And Alice has invited Bob to the second side
      And Alice is ready for the game session
      When Alice starts the game session
      Then Alice is told both sides need participants

    Scenario: A participant cannot start instead of the creator
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      When Bob starts the game session
      Then Bob is told only the creator starts the game session

  Rule: Starting again never restarts the same game session

    Scenario: Repeating an acknowledged start keeps the current board
      Given Alice and Bob have a game session under way
      When Alice starts the game session
      Then the game session remains under way with no new game

    Scenario: A finished game cannot restart
      Given Alice has a finished game session
      When Alice starts the game session
      Then Alice is told the game is finished

    Scenario: A cancelled game cannot restart
      Given Alice has a cancelled game session
      When Alice starts the game session
      Then Alice is told the game session was cancelled

  Rule: A start uses the set-up the participants agreed to

    Scenario: Two starts produce one game
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      When Alice starts the game session twice at the same time
      Then the game session remains under way with no new game

    Scenario: A stale start cannot bypass a changed set-up
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      And the game session's set-up changed before Alice's start
      When Alice starts the game session with the earlier set-up
      Then Alice is told the game session's set-up has changed

  Rule: A person may withdraw readiness until the game session starts

    Scenario: A ready person withdraws their agreement
      Given Alice is setting up a game session with Bob on the second side
      And Alice and Bob are ready for the game session
      When Bob withdraws readiness for the game session
      Then Bob is not ready for the game session
      And the game session cannot start

    Scenario: Readiness cannot be withdrawn after start
      Given Alice and Bob have a game session under way
      When Bob withdraws readiness for the game session
      Then Bob is told the game session has already started
