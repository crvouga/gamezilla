@domain:games
Feature: A matched game drawn by the game's own rules
  When the game's own rules draw a matched game, both people want the same draw at once, so the matched game is over for both of them.

  Rule: A move that draws the game by its own rules gives both people the same draw at once
    No counter-example: the game's own rules decide the draw, and nobody can choose to play on.

    Scenario: A move that draws by the game's own rules gives both people the same draw
      Given Alice has the first side against Bob in a matched game one move from a draw by the game's own rules
      When the person whose turn it is makes the drawing move
      Then both people see the matched game is drawn by the game's own rules
