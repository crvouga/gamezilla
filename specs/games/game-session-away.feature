@domain:games
Feature: Claim the win from a participant who stays away
  When the other participant has gone away from a game session under way, a participant wants to claim the win after a fair wait, so a game session is never stuck with nobody on the other side.

  Rule: Being away never gives up a game session on its own
    No counter-example: only a claim, the clock or the game's own rules finish the game session of someone who is away.

    Scenario: A participant who comes back before any claim continues the game session
      Given Alice and Bob have a game session under way
      And Bob has been away from the game session for 10 minutes
      When the connection comes back
      Then Bob sees the game session under way with the first side to move
      And neither person has won the game session

    Scenario: The host's clock keeps running while she is away
      Given Alice and Bob have a game session under way played at 1+0
      And Alice is away from the game session
      And 60 seconds have passed
      When the connection comes back
      Then Bob wins the game session on time

  Rule: After 60 seconds away, the other participant may claim the win

    Scenario: The first side claims the win after the second side stayed away for 60 seconds
      Given Alice and Bob have a game session under way
      And Bob has been away from the game session for 60 seconds
      When Alice claims the win
      Then Alice wins the game session because Bob stayed away

    Scenario: A claim after 59 seconds away is refused
      Given Alice and Bob have a game session under way
      And Bob has been away from the game session for 59 seconds
      When Alice claims the win
      Then Alice is told Bob may still return
      And the game session remains under way

    Scenario: A watcher cannot claim the win
      Given Alice and Bob have a game session under way watched by Carol
      And Bob has been away from the game session for 60 seconds
      When Carol claims the win
      Then Carol is told she is not a participant
      And the game session remains under way

    Scenario: A claim cannot replace a finished result
      Given Alice has a finished game session
      And Bob is offline
      When Alice claims the win
      Then Alice is told the game is finished
      And the finished game session is unchanged
