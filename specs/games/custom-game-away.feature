@domain:games
Feature: Claim the win from a participant who stays away
  When the other participant has gone away from a custom game under way, a participant wants to claim the win after a fair wait, so a custom game is never stuck with nobody on the other side.

  Rule: Being away never gives up a custom game on its own
    No counter-example: only a claim, the clock or the game's own rules finish the custom game of someone who is away.

    Scenario: A participant who comes back before any claim continues the custom game
      Given Alice and Bob have a custom game under way
      And Bob has been away from the custom game for 10 minutes
      When the connection comes back
      Then Bob sees the custom game under way with the first side to move
      And neither person has won the custom game

    Scenario: The host's clock keeps running while she is away
      Given Alice and Bob have a custom game under way played at 1+0
      And Alice is away from the custom game
      And 60 seconds have passed
      When the connection comes back
      Then Bob wins the custom game on time

  Rule: After 60 seconds away, the other participant may claim the win

    Scenario: The first side claims the win after the second side stayed away for 60 seconds
      Given Alice and Bob have a custom game under way
      And Bob has been away from the custom game for 60 seconds
      When Alice claims the win
      Then Alice wins the custom game because Bob stayed away

    Scenario: A claim after 59 seconds away is refused
      Given Alice and Bob have a custom game under way
      And Bob has been away from the custom game for 59 seconds
      When Alice claims the win
      Then Alice is told Bob may still return
      And the custom game remains under way

    Scenario: A watcher cannot claim the win
      Given Alice and Bob have a custom game under way watched by Carol
      And Bob has been away from the custom game for 60 seconds
      When Carol claims the win
      Then Carol is told she is not a participant
      And the custom game remains under way

    Scenario: A claim cannot replace a finished result
      Given Alice has a finished custom game
      And Bob is offline
      When Alice claims the win
      Then Alice is told the game is finished
      And the finished custom game is unchanged
