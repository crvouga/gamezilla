@domain:hearts
Feature: Score deals and decide who wins Hearts
  When a deal's 13 tricks are taken, every player wants the penalty points counted the same way for everyone and the Hearts game to be over at the agreed score, so the lowest score fairly wins.

  Background:
    Given Alice, Bob, Carol and Dave are playing Hearts as South, West, North and East

  Rule: Each heart taken scores one penalty point and the queen of spades 13
    No counter-example: a deal's score comes only from the cards each player took.

    Scenario: A deal scores the hearts and the queen of spades each player took
      Given in this deal South took the queen of spades and three hearts, North the other ten hearts, and West and East no penalty points
      When the deal is scored
      Then the deal's scores are South 16, West 0, North 10 and East 0

  Rule: A player who takes all 26 penalty points shoots the moon, scoring 0 while each other player scores 26
    No counter-example: shooting the moon needs every heart and the queen of spades; one heart short scores as usual, as shown.

    Scenario: Taking every heart and the queen of spades shoots the moon
      Given in this deal North took every heart and the queen of spades
      When the deal is scored
      Then the deal's scores are South 26, West 26, North 0 and East 26

    Scenario: Taking all but one heart does not shoot the moon
      Given in this deal North took the queen of spades and every heart but the two of hearts, which East took
      When the deal is scored
      Then the deal's scores are South 0, West 0, North 25 and East 1

  Rule: Another deal follows while every cumulative score is below 100, carrying over the scores and the passing direction
    No counter-example: no person decides whether another deal follows; the scores alone do, as 99 and 100 show.

    Background:
      Given it is the sixth deal, and after five deals the scores stand at South 12, West 90, North 14 and East 14

    Scenario: A deal that keeps every score below 100 is followed by the next deal
      Given in this deal South took 0 penalty points, West 9, North 17 and East 0
      When the deal is scored
      Then the cumulative scores are South 12, West 99, North 31 and East 14
      And the seventh deal is dealt, passing across

    Scenario: A deal that brings a score to 100 is the last deal
      Given in this deal South took 0 penalty points, West 10, North 16 and East 0
      When the deal is scored
      Then the cumulative scores are South 12, West 100, North 30 and East 14
      And the Hearts game is over with no seventh deal

  Rule: Once the Hearts game is over, the lowest cumulative score wins, and players tied for it share the victory
    No counter-example: the scores alone decide the winners.

    Background:
      Given after five deals the scores stand at South 12, West 90, North 14 and East 14

    Scenario: The lowest score wins alone
      Given in this deal South took 0 penalty points, West 11, North 2 and East 13
      When the deal is scored
      Then the Hearts game is over and South wins alone with 12
      And every player and watcher sees the final scores and South as the winner

    Scenario: Players tied for the lowest score share the victory
      Given in this deal South took 2 penalty points, West 11, North 0 and East 13
      When the deal is scored
      Then the Hearts game is over and South and North share the victory with 14
      And every player and watcher sees the final scores and both winners

  Rule: A Hearts game that is over takes no more passes or cards
    No counter-example: a Hearts game that is over only refuses; how it comes to be over is the rule above.

    Background:
      Given the Hearts game is over with South the winner

    Scenario: A card played once the Hearts game is over is refused
      When Bob plays the two of clubs
      Then Bob is told the Hearts game is over
      And the final scores and winner are unchanged

    Scenario: A pass once the Hearts game is over is refused
      When Carol passes the ace, king and queen of hearts
      Then Carol is told the Hearts game is over
      And the final scores and winner are unchanged
