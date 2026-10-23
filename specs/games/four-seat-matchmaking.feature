@domain:games
Feature: Find four participants and agree to another game
  When Alice seeks a four-player game, she wants compatible participants and a fair rematch, so everyone plays the same game and agrees to play again.

  Rule: A four-player matched game requires the same game and clock choice for every participant

    Scenario: The fourth compatible person completes the matched game
      Given Alice, Bob and Carol are seeking the same four-player game at 5+0
      When Dave seeks that four-player game at 5+0
      Then all four people have one matched game with four distinct sides

    Scenario: A different clock choice cannot complete the matched game
      Given Alice, Bob and Carol are seeking the same four-player game at 5+0
      When Dave seeks that four-player game at 3+0
      Then no four-player matched game starts

  Rule: Every person must agree to a matched-game rematch and sides rotate

    Scenario: The last rematch agreement starts a new game with rotated sides
      Given Alice, Bob, Carol and Dave have a finished four-player matched game
      And Alice has offered a rematch accepted by Bob and Carol
      When Dave accepts the rematch
      Then all four people have a new matched game at the same clock choice
      And each person has the next side in the declared turn order

    Scenario: Partial rematch agreement creates no new game
      Given Alice, Bob, Carol and Dave have a finished four-player matched game
      And Alice has offered a rematch accepted by Bob
      When Carol accepts the rematch
      Then the finished matched game is still awaiting Dave's rematch agreement

  Rule: Withdrawal or an expired clock draws a four-player matched game even before the first moves
    No counter-example: after withdrawal or an expired clock there is no rule that chooses one of three remaining players as the winner.

    Scenario: Account deletion before any first move draws the matched game
      Given Alice, Bob, Carol and Dave have a new four-player matched game at 5+0
      When Alice confirms account deletion
      Then Bob, Carol and Dave see the matched game is drawn because a participant withdrew

    Scenario: Missing the first move draws the four-player matched game
      Given Alice, Bob, Carol and Dave have a new four-player matched game at 5+0
      When 30 seconds pass
      Then all four people see the matched game is drawn because the first side missed the first move
