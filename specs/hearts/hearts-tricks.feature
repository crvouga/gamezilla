@domain:hearts
Feature: Play tricks
  When the cards are passed, each player wants every trick played in turn by the same rules, so the highest card of the suit led fairly takes it.

  Background:
    Given Alice, Bob, Carol and Dave are playing Hearts as South, West, North and East

  Rule: The player holding the two of clubs leads it to the first trick

    Background:
      Given every player has passed in the first deal and North holds the two of clubs

    Scenario: The two of clubs leads the first trick
      When Carol plays the two of clubs
      Then the two of clubs leads the first trick
      And it is East's turn

    Scenario: The first trick cannot begin with another card
      When Carol plays the ace of clubs
      Then Carol is told the first trick begins with the two of clubs
      And Carol still holds the ace of clubs

  Rule: Only the player whose turn it is plays, and only a card from their own hand

    Background:
      Given South has led the two of clubs to the first trick
      And West holds the nine of clubs but not the ace of spades

    Scenario: The next player clockwise plays after the leader
      When Bob plays the nine of clubs
      Then the nine of clubs is in the current trick
      And it is North's turn

    Scenario: A card out of turn is refused
      When Carol plays the king of clubs
      Then Carol is told it is West's turn
      And the current trick still holds only the two of clubs

    Scenario: A card the player does not hold is refused
      When Bob plays the ace of spades
      Then Bob is told he does not hold the ace of spades
      And the current trick still holds only the two of clubs

  Rule: A player must follow suit when they can

    Scenario: A player who can follow suit must
      Given South has led the two of clubs to the first trick
      And West holds the nine of clubs and the ace of diamonds
      When Bob plays the ace of diamonds
      Then Bob is told he must follow suit with a club
      And Bob still holds the ace of diamonds

    Scenario: A player with no card of the suit led may play another suit
      Given North has led the five of clubs to the third trick
      And East holds no clubs
      When Dave plays the ace of diamonds
      Then the ace of diamonds is in the current trick
      And it is South's turn

  Rule: The highest card of the suit led takes the trick, and its winner leads the next
    No counter-example: a card of another suit never takes the trick, however high, as the ace of spades shows.

    Scenario: The highest card of the suit led takes the trick
      Given West has led the ten of diamonds to the fourth trick
      And North has played the king of diamonds and East the ace of spades
      When Alice plays the jack of diamonds
      Then North takes the trick with the king of diamonds
      And it is North's turn to lead the next trick
