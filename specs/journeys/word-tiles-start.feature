@domain:journeys
Feature: Start Word Tiles against bots
  When Alice wants to play Word Tiles on her own, she wants bots for the game she chooses, so she can begin without waiting for other people.

  Rule: A person on a fresh device can start each Word Tiles game against bots

    Scenario Outline: A fresh guest begins the chosen Word Tiles game with bots
      When Alice starts "<game>" with bots from a fresh device
      Then Alice sees "<game>" under way against bots

      Examples:
        | game                 |
        | Word Tiles           |
        | Word Tiles for three |
        | Word Tiles for four  |
