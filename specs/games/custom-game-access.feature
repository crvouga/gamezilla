@domain:games
Feature: Custom games follow the space's access
  When someone wants to play or watch a custom game, they want the space's access to decide who belongs there, so a custom game reveals nothing to someone outside the space.

  Rule: Everyone already in the space may watch the same custom game

    Scenario: A guest watches without taking a side
      Given Alice and Bob have a custom game under way
      And Carol is a guest in Alice's space
      When Carol watches the custom game
      Then Carol sees the custom game under way with the first side to move
      And Carol cannot make a move

    Scenario: Someone outside the space cannot watch the custom game
      Given Alice and Bob have a custom game under way
      And Carol is outside Alice's space
      When Carol tries to watch the custom game
      Then Carol cannot see the custom game

    Scenario: Someone outside the space cannot review a finished custom game
      Given Alice has a finished custom game
      And Carol is outside Alice's space
      When Carol tries to watch the custom game
      Then Carol cannot see the custom game

  Rule: Joining a space follows that space's rules before a side can be claimed

    Scenario: A guest who joined from the space link may claim an open side
      Given Alice is setting up a custom game
      And Carol is a guest in Alice's space
      When Carol claims the second side
      Then the second side is Carol

    Scenario: Someone outside the space cannot claim a side by knowing about it
      Given Alice is setting up a custom game
      And Carol is outside Alice's space
      When Carol claims the second side
      Then Carol is told she is not in the space

  Rule: Paid access changes no custom game choice

    Scenario: Free access keeps a custom game against a bot available
      Given Alice is signed in
      And Alice is setting up a custom game
      And Alice's paid access has ended
      When Alice assigns a bot to the second side
      Then the second side is a bot

    Scenario: Paid access does not let a watcher set up another person's custom game
      Given Alice and Bob have a custom game under way
      And Carol is a Plus member in Alice's space
      When Carol assigns a bot to the second side
      Then Carol is told only the creator sets up the custom game
