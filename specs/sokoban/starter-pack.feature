@domain:sokoban
Feature: Play the Sokoban starter pack
  When Bob first tries Sokoban, he wants a few introductory puzzles ready to play, so he can learn Sokoban before choosing puzzles other people made.

  Rule: Everyone can play the starter pack, a guest too, with or without a connection
    No counter-example: the starter pack comes with the app for every kind of person.

    Scenario: A guest can start the first starter puzzle
      Given Bob is a guest
      When Bob starts the first starter puzzle
      Then Bob sees the first starter puzzle's starting position

    Scenario: The starter pack can be played without a connection
      Given Bob's phone has no connection
      When Bob starts the first starter puzzle
      Then Bob sees the first starter puzzle's starting position

  Rule: Completing a starter puzzle offers the first unfinished one in the pack's order

    Scenario: Completing the first starter puzzle offers the second
      Given Bob is playing the first starter puzzle
      When Bob completes that puzzle
      Then Bob is offered the second starter puzzle as the next puzzle

    Scenario: Continuing the starter pack goes to the first unfinished puzzle
      Given Bob has completed the first starter puzzle
      When Bob continues the starter pack
      Then Bob sees the second starter puzzle's starting position

    Scenario: A complete starter pack offers no unfinished puzzle
      Given Bob has completed every starter puzzle
      When Bob continues the starter pack
      Then Bob is not offered an unfinished puzzle

  Rule: Starter pack completions made offline reach the person's other device
    No counter-example: a completion is never lost; it waits on the phone until the connection returns.

    Scenario: An offline completion reaches the tablet when the connection returns
      Given Bob has completed the first starter puzzle on his offline phone
      When Bob's phone is back online
      Then Bob's tablet shows the first starter puzzle completed
