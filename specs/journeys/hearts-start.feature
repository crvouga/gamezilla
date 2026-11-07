@domain:journeys
Feature: Start Hearts against bots
  When Alice wants to play Hearts on her own, she wants bots to play with her, so she can begin a game without waiting for other people.

  Rule: A person on a fresh device can start Hearts against bots

    Scenario: A fresh guest begins Hearts with bots
      When Alice starts "Hearts" with bots from a fresh device
      Then Alice sees "Hearts" under way against bots
