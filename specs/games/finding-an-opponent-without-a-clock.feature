@domain:games
Feature: Find an opponent without choosing a clock
  When a game offers no clock choice, a person wants an opponent for that game, so they can play without choosing time they do not need.

  Background:
    Given the game offers no clock choice

  Rule: Finding an opponent shows no clock choice when the game offers none
    No counter-example: opening, waiting and being paired cannot offer a clock choice the game does not have.

    Scenario: Opening finding an opponent offers no clock choice
      Given Alice has a free account and a connection
      When Alice opens finding an opponent
      Then Alice is not asked to choose a clock

    Scenario: A search without a clock still shows how long the person has waited
      Given Alice is seeking an opponent for the game
      When 40 seconds pass
      Then Alice sees she has been waiting for an opponent for 40 seconds without a clock choice

    Scenario: A pair sees the game's rating and their sides without a clock choice
      Given Bob has a rating of 1620 for the game
      And Alice and Bob are seeking an opponent for the game
      When they are paired
      Then Alice sees Bob as her opponent, with a rating of "1620" and her side, without a clock choice
      And Bob sees Alice as his opponent, with a rating of "1500?" and his side, without a clock choice

  Rule: Losing a connection keeps the last known search or matched game
    No counter-example: a missing connection cannot replace the search or matched game the device last showed.

    Scenario: A person without a connection keeps the search they were shown
      Given Alice is seeking an opponent for the game
      When Alice loses the connection
      Then Alice is still waiting with her same search
      And Alice is told finding an opponent needs a connection

    Scenario: A returning person sees the same search when nobody has been paired
      Given Alice is seeking an opponent for the game without a connection
      When Alice comes back online
      Then Alice is still waiting with her same search
      And Alice is not asked to choose a clock

    Scenario: A returning person sees the matched game agreed while she was away
      Given Alice was paired with Bob while her device was offline
      When Alice comes back online
      Then Alice keeps her matched game with Bob
      And Alice is not asked to choose a clock
