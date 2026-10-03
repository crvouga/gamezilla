@domain:chess
Feature: Become ready and start
  When the participants have chosen their game, the creator wants to start only after they agree, so nobody begins with missing participants or unfamiliar choices.

  Rule: Every person confirms readiness for the current choices

    Scenario: The second person makes a complete game startable
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice is ready for the Custom Game
      When Bob becomes ready for the Custom Game
      Then The Custom Game is startable

    Scenario: A watcher cannot become ready for a participant
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Carol is in Alice's space
      When Carol becomes ready for the Custom Game
      Then Carol is told only a participant may become ready

  Rule: Changing the choices clears each person's readiness

    Scenario: A time choice requires renewed agreement
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      When Alice chooses 5 minutes with 2 seconds increment for the Custom Game
      Then Neither person is ready for the Custom Game
      And The Custom Game has 5 minutes with 2 seconds increment

    Scenario: A participant who is no longer ready stops the start
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      And Bob is no longer ready for the Custom Game
      When Alice starts the Custom Game
      Then Alice is told every person must be ready

  Rule: Only the creator starts a complete ready game

    Scenario: Ready participants start one game
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      When Alice starts the Custom Game
      Then The Custom Game is active with White to move

    Scenario: An open place prevents start
      Given Alice has a configuring Custom Game
      And Alice is ready for the Custom Game
      When Alice starts the Custom Game
      Then Alice is told both sides need participants

    Scenario: An invitation prevents start
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is reserved for Bob
      And Alice is ready for the Custom Game
      When Alice starts the Custom Game
      Then Alice is told both sides need participants

    Scenario: A participant cannot start instead of the creator
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      When Bob starts the Custom Game
      Then Bob is told only the creator starts the Custom Game

  Rule: Starting again never restarts the same game

    Scenario: Repeating an acknowledged start keeps the current board
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice starts the Custom Game
      Then The Custom Game remains active with no new game

    Scenario: A completed game cannot restart
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      When Alice starts the Custom Game
      Then Alice is told the Custom Game has finished

    Scenario: A cancelled game cannot restart
      Given Alice has a cancelled Custom Game
      When Alice starts the Custom Game
      Then Alice is told the Custom Game was cancelled

  Rule: A start uses the choices the participants agreed to

    Scenario: Two starts produce one game
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      When Alice starts the Custom Game twice at the same time
      Then The Custom Game remains active with no new game

    Scenario: A stale start cannot bypass changed choices
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      And The Custom Game choices changed before Alice's start
      When Alice starts the Custom Game with the earlier choices
      Then Alice is told the Custom Game choices have changed

