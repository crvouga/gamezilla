@domain:light-cycles
Feature: Play Light Cycles in rounds
  When a round ends, everyone wants the last rider riding to score once and a fresh round to follow, so every round is a fair new start with the score kept.

  Rule: Every rider waits on its starting cell until the 3-second countdown ends

    Background:
      Given Alice rides Comet and Bob rides Ember in a Light Cycles Duel

    Scenario: Riders set off when the countdown ends
      Given the first round is counting down
      When the Light Cycles countdown ends
      Then Comet and Ember are riding from their starting cells

    Scenario: Riders stay on their starting cells during the countdown
      Given the first round is counting down with 3 seconds left
      When 2 seconds pass
      Then Comet and Ember are still on their starting cells

  Rule: The last rider riding wins the round and scores one round win

    Scenario: The rider left riding in a Duel wins the round
      Given Alice rides Comet and Bob rides Ember in a Light Cycles Duel
      And no rider has a round win
      When Ember crashes
      Then everyone sees Comet won the round
      And Comet has 1 round win and Ember has 0

    Scenario: One crash in a Trio keeps the round going
      Given Alice rides Comet, Bob rides Ember and Carol rides Nova in a Light Cycles Trio
      And no rider has a round win
      When Ember crashes
      Then Comet and Nova are still riding
      And no rider has a round win

  Rule: A round in which no rider is left riding is drawn and nobody scores
    No counter-example: a round with one rider left riding is won, as the rule before shows.

    Scenario: The round is drawn when the last two riders crash at the same step
      Given Alice rides Comet and Bob rides Ember in a Light Cycles Duel
      And Comet has 1 round win and Ember has 0
      When Comet and Ember both crash
      Then everyone sees the round is drawn
      And Comet still has 1 round win and Ember has 0

  Rule: The round result shows for 2 seconds, then every rider rides again on a clear arena with the score kept
    No counter-example: while the game is unfinished, a new round always follows the round result.

    Scenario: A crashed rider rides again in the next round with the score kept
      Given Alice rides Comet and Bob rides Ember in a Light Cycles Duel
      And Comet won the first round after Ember crashed
      When 2 seconds pass
      Then the second round is counting down on an arena with no trails
      And Comet and Ember are on their starting cells
      And Comet has 1 round win and Ember has 0
