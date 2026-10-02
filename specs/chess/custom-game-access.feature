@domain:chess
Feature: Custom Games follow the space's access
  When someone wants to play or watch a Custom Game, they want the space's access to decide who belongs there, so a game reveals nothing to an outsider.

  Rule: Everyone already in the space may watch the same Custom Game

    Scenario: A guest watches without taking a side
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Carol is a guest in Alice's space
      When Carol watches the Custom Game
      Then Carol sees the active Custom Game with White to move
      And Carol cannot move pieces in the Custom Game

    Scenario: An outsider cannot watch the game
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Carol is outside Alice's space
      When Carol tries to watch the Custom Game
      Then Carol cannot see the Custom Game

  Rule: Joining a space follows that space's rules before a side can be claimed

    Scenario: A guest joining from the space link may take an open place
      Given Alice has a configuring Custom Game
      And Carol has joined Alice's space from the link
      When Carol claims Black in the Custom Game
      Then Black is Carol in the Custom Game

    Scenario: An outsider cannot claim a side by knowing about it
      Given Alice has a configuring Custom Game
      And Carol is outside Alice's space
      When Carol claims Black in the Custom Game
      Then Carol is told they are not in the space

  Rule: Paid access changes no Custom Game choice

    Scenario: Free access keeps a bot game available
      Given Alice is signed in
      And Alice has a configuring Custom Game
      And Alice's paid access has ended
      When Alice assigns a bot to Black in the Custom Game
      Then Black is a bot in the Custom Game

    Scenario: Paid access does not let a watcher configure another person's game
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Carol is a Plus member in Alice's space
      When Carol assigns a bot to Black in the Custom Game
      Then Carol is told only the creator configures the Custom Game
