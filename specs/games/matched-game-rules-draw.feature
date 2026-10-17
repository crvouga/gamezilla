@domain:games
Feature: A matched game drawn by the game's own rules
  When the game's own rules draw a matched game, both people want the same draw at once, so the matched game is over for both of them.

  Rule: A move that draws the game by its own rules gives both people the same draw at once
    No counter-example: the game's own rules decide the draw, and nobody can choose to play on.

    Scenario: A move that draws by the game's own rules gives both people the same draw
      Given Alice has the first side against Bob in a matched game one move from a draw by the game's own rules
      When the person whose turn it is makes the drawing move
      Then both people see the matched game is drawn by the game's own rules

  Rule: A daily game drawn by the game's own rules leaves both of its people a result notice saying so
    No counter-example: the game's own rules decide the draw, and both people's result notices say the same.

    Scenario: A daily game drawn by the game's own rules leaves both people a result notice
      Given Alice has the first side against Bob in a daily game at 3 days per move one move from a draw by the game's own rules
      When the person whose turn it is makes the drawing move
      Then Alice's inbox shows within 15 seconds a result notice of a daily game drawn against Bob by the game's own rules
      And Bob's inbox shows within 15 seconds a result notice of a daily game drawn against Alice by the game's own rules
