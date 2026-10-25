@domain:games
Feature: Make secret choices at the same time
  When a game's rules have every side choose in secret before play goes on, each person wants to choose without anyone learning their choice or seeing others choose first, so nobody gains by waiting. It holds for every game with secret choices that offers custom games.

  Rule: A participant makes one secret choice in each round of secret choices

    Background:
      Given Alice, Bob, Carol and Dave have a four-player custom game awaiting secret choices

    Scenario: A participant's secret choice is accepted
      When Bob makes his secret choice
      Then Bob sees his own secret choice
      And Alice, Carol and Dave see Bob has made his secret choice

    Scenario: A second secret choice in the same round is refused
      Given Bob has made his secret choice
      When Bob makes another secret choice
      Then Bob is told he has already made his secret choice
      And Bob's secret choice is unchanged

    Scenario: A watcher cannot make a secret choice
      Given Eve is watching the custom game
      When Eve makes a secret choice
      Then Eve is told she is not a participant
      And nobody has made a secret choice

  Rule: A secret choice is refused when the custom game is not awaiting one from that round

    Scenario: A secret choice for an earlier round is refused
      Given Alice, Bob, Carol and Dave have a four-player custom game in its second round of secret choices
      When Bob makes his secret choice for the earlier round of secret choices
      Then Bob is told that secret choice was for an earlier round of secret choices
      And nobody has made a secret choice

    Scenario: A secret choice while play goes on is refused
      Given Alice, Bob, Carol and Dave have a four-player custom game with Bob to move
      When Carol makes her secret choice
      Then Carol is told the custom game is not awaiting secret choices
      And Bob keeps the custom game turn

    Scenario: A new round of secret choices starts with nobody chosen
      Given Alice, Bob, Carol and Dave have a four-player custom game whose secret choices have taken effect
      When play reaches the next round of secret choices
      Then the custom game is awaiting secret choices
      And nobody has made a secret choice

  Rule: Only its own person sees a secret choice, and everyone sees which sides have made theirs
    No counter-example: nothing anyone does shows them another side's secret choice; a watcher's attempt to choose is refused above.

    Background:
      Given Alice, Bob, Carol and Dave have a four-player custom game awaiting secret choices
      And Eve is watching the custom game

    Scenario: Others see that a side has chosen but not its secret choice
      When Bob makes his secret choice
      Then Alice, Carol, Dave and Eve see Bob has made his secret choice
      And Alice, Carol, Dave and Eve cannot see Bob's secret choice

    Scenario: A device without a connection does not show who has chosen until the connection comes back
      Given Eve's phone is offline
      When Bob makes his secret choice
      Then Eve does not see Bob has made his secret choice until the connection comes back
      And Eve cannot see Bob's secret choice

  Rule: Nothing a round's secret choices decide happens until every side has made one, and then all take effect at once

    Background:
      Given Alice, Bob, Carol and Dave have a four-player custom game awaiting secret choices

    Scenario: The last secret choice makes every secret choice take effect together
      Given Alice, Bob and Carol have made their secret choices
      When Dave makes his secret choice
      Then every secret choice of the round takes effect at once
      And the custom game goes on as the game's rules say

    Scenario: Play waits for the last secret choice
      Given Alice, Bob and Carol have made their secret choices
      When Alice makes her move
      Then Alice is told the custom game is awaiting Dave's secret choice
      And no secret choice has taken effect

  Rule: A bot makes its own side's secret choice
    No counter-example: a bot never waits for anyone to choose for it.

    Scenario: Bots choose for their sides, so the person's secret choice completes the round
      Given Alice has a four-player custom game against three bots awaiting secret choices
      When Alice makes her secret choice
      Then every secret choice of the round takes effect at once

  Rule: With another person in the custom game, making a secret choice needs a connection

    Scenario: A participant back online makes their secret choice
      Given Alice, Bob, Carol and Dave have a four-player custom game awaiting secret choices
      And Bob is back online after his offline secret choice was refused
      When Bob makes his secret choice
      Then Alice, Carol and Dave see Bob has made his secret choice

    Scenario: A participant without a connection cannot make a secret choice
      Given Alice, Bob, Carol and Dave have a four-player custom game awaiting secret choices
      And Bob is offline
      When Bob makes his secret choice
      Then Bob is told the game needs a connection
      And nobody has made a secret choice

    Scenario: A person alone with three bots makes their secret choice offline
      Given Alice has a four-player custom game against three bots awaiting secret choices
      And Alice is offline
      When Alice makes her secret choice
      Then every secret choice of the round takes effect at once
