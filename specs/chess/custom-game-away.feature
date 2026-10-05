@domain:chess
Feature: Claim the win from a participant who stays away
  When the other participant has gone away from an active Custom Game, a participant wants to claim the win after a fair wait, so a game is never stuck with nobody on the other side.

  Rule: Being away never gives up a Custom Game on its own
    No counter-example: only a claim, the clock or a chess ending finishes the game of someone who is away.

    Scenario: A participant who comes back before any claim continues the game
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Bob has been away from the Custom Game for 10 minutes
      When the connection comes back
      Then Bob sees the active Custom Game with White to move
      And Neither person has won the Custom Game

    Scenario: An away participant's clock keeps running
      Given Alice has an active Custom Game with 1 minute and 0 seconds increment
      And Alice is away from the Custom Game
      When 60 seconds pass
      Then Bob wins the Custom Game on time

  Rule: After 60 seconds away, the other participant may claim the win

    Scenario: White claims the win after Black stayed away for 60 seconds
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Bob has been away from the Custom Game for 60 seconds
      When Alice claims the win in the Custom Game
      Then Alice wins the Custom Game because Bob stayed away

    Scenario: A claim after 59 seconds away is refused
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Bob has been away from the Custom Game for 59 seconds
      When Alice claims the win in the Custom Game
      Then Alice is told Bob may still return
      And The Custom Game remains active

    Scenario: A watcher cannot claim the win
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Bob has been away from the Custom Game for 60 seconds
      And Carol is in Alice's space
      When Carol claims the win in the Custom Game
      Then Carol is told only a participant may claim the win
      And The Custom Game remains active

    Scenario: A claim cannot replace a completed outcome
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      And Bob is offline
      When Alice claims the win in the Custom Game
      Then Alice is told the Custom Game has finished
      And The Custom Game keeps its completed outcome
