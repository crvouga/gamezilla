@domain:journeys
Feature: Play the first trick of Hearts against bots
  When Alice plays Hearts on her own, she wants to pass her cards and play with the bots, so she knows a Hearts game against bots really plays and does not only open.

  Rule: A person on a fresh device can pass and finish the first trick against bots
    No counter-example: refused passes and refused cards are covered by the Hearts rules.

    Scenario: A fresh guest passes three cards and sees the first trick taken
      When Alice passes three cards and plays the first trick of Hearts against bots from a fresh device
      Then Alice sees the first trick taken, with 12 cards left in her hand
