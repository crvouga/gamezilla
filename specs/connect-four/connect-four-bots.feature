@domain:connect-four
Feature: Play Connect Four with bots
  When Alice chooses a bot, she wants an opponent at her chosen difficulty, so she can play either side or watch two bots finish.

  Rule: Stronger bots take a victory and defend an immediate threat
    No counter-example: when no defense can prevent defeat, the bot still makes a legal drop.

    Scenario: A Hard bot takes its winning column
      Given a Hard Connect Four bot can win on its turn
      When the Connect Four bot plays
      Then the Connect Four bot wins immediately

    Scenario: A Hard bot blocks the opponent's winning column
      Given a Hard Connect Four bot can prevent the opponent's next-turn victory
      When the Connect Four bot plays
      Then the opponent has no immediate Connect Four victory
