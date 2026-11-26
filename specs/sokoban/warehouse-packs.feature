@domain:sokoban
Feature: Play the Sokoban warehouse packs
  When Bob wants more Sokoban puzzles, he wants packs ready to play on his phone, so he can keep playing without a connection.

  Rule: A guest can play the warehouse packs that come with Sokoban without a connection
    No counter-example: the packs are available to everyone.

    Scenario: An offline guest completes a puzzle from the receiving dock
      Given Bob is a guest
      And Bob's phone has no connection
      And Bob is playing "Dock 01" from the Sokoban pack "Receiving dock"
      When Bob completes that puzzle
      Then the Sokoban puzzle is complete
      And "Dock 01" remains completed in Bob's progress
