@domain:hearts
Feature: Hearts and the queen of spades on the first trick, and leading hearts
  When Alice plays Hearts, she wants penalty points kept off the first trick and hearts led only once they are broken, so no one is handed penalty points before play has properly begun.

  Background:
    Given Alice, Bob, Carol and Dave are playing Hearts as South, West, North and East

  Rule: On the first trick, nobody plays a heart or the queen of spades while they hold anything else

    Background:
      Given South has led the two of clubs to the first trick

    Scenario: The queen of spades is refused on the first trick
      Given West holds no clubs, but holds the queen of spades and the ace of diamonds
      When Bob plays the queen of spades
      Then Bob is told hearts and the queen of spades cannot be played on the first trick
      And Bob still holds the queen of spades

    Scenario: A heart is refused on the first trick
      Given West holds no clubs, but holds the ace of hearts and the ace of diamonds
      When Bob plays the ace of hearts
      Then Bob is told hearts and the queen of spades cannot be played on the first trick
      And Bob still holds the ace of hearts

    Scenario: A player holding nothing else may play a heart on the first trick
      Given West holds no clubs and holds only hearts and the queen of spades
      When Bob plays the ace of hearts
      Then the ace of hearts is in the current trick
      And it is North's turn

  Rule: Hearts are broken once a heart is played, and the queen of spades alone does not break them

    Background:
      Given it is South's turn to lead the fifth trick of the first deal, holding hearts and clubs

    Scenario: A heart played earlier in the deal lets a heart be led
      Given East played the two of hearts in the third trick
      When Alice leads the ace of hearts
      Then the ace of hearts leads the fifth trick
      And it is West's turn

    Scenario: The queen of spades played earlier in the deal does not let a heart be led
      Given West played the queen of spades in the third trick and no heart has been played in this deal
      When Alice leads the ace of hearts
      Then Alice is told hearts are not broken yet
      And Alice still holds the ace of hearts

  Rule: A heart cannot be led before hearts are broken, unless the leader holds only hearts

    Background:
      Given no heart has been played in the first deal and it is South's turn to lead the fifth trick

    Scenario: A heart led before hearts are broken is refused
      Given South holds hearts and clubs
      When Alice leads the ace of hearts
      Then Alice is told hearts are not broken yet
      And Alice still holds the ace of hearts

    Scenario: A player holding only hearts may lead one before hearts are broken
      Given South holds only hearts
      When Alice leads the five of hearts
      Then the five of hearts leads the fifth trick
      And it is West's turn
