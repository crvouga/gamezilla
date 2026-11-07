@domain:journeys
Feature: Start Light Cycles against bots
  When Alice wants to play Light Cycles on her own, she wants bots for the game she chooses, so she can begin without waiting for other people.

  Rule: A person on a fresh device can start each Light Cycles game against bots

    Scenario Outline: A fresh guest begins the chosen Light Cycles game with bots
      When Alice starts "<game>" with bots from a fresh device
      Then Alice sees "<game>" under way against bots

      Examples:
        | game              |
        | Light Cycles Duel |
        | Light Cycles Trio |
        | Light Cycles Quad |
