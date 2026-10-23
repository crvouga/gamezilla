@domain:quoridor
Feature: Race a Quoridor bot to the selected goal
  When Alice plays a Quoridor bot, she wants it to pursue the selected goal, so both modes have an opponent that can finish the game.

  Rule: A bot takes a victory available on its turn
    No counter-example: if the game is finished the shared bot contract allows no further action.

    Scenario: A Classic bot reaches the opposite home row
      Given a Quoridor bot has a Classic game one pawn move from victory
      When the Quoridor bot moves its pawn
      Then South wins Classic Quoridor immediately

    Scenario: A King of the Hill bot claims the center
      Given a Quoridor bot has a hill mode game one pawn move from victory
      When the Quoridor bot moves its pawn
      Then South wins Four-Player King of the Hill immediately
