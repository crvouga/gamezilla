@domain:hearts
Feature: Keep a Hearts game going while a player is offline
  When a person playing Hearts loses their connection, the others want a stand-in to pass and play for them with only that player's cards, and the person wants to take back their side and their own hand when they return, so the Hearts game is never held up and no hand is shown to anyone else.

  Background:
    Given Alice, Bob, Carol and Dave are playing Hearts as South, West, North and East

  Rule: A stand-in passes and plays only cards from its player's own hand, by the same rules
    No counter-example: a stand-in never plays or passes a card its player does not hold.

    Scenario: A stand-in passes three cards from the hand of a person offline for 60 seconds
      Given the first deal is awaiting passes and South, North and East have passed
      And Bob's phone has been offline for 60 seconds
      When Bob's stand-in passes for West
      Then three cards from West's hand are passed to North
      And Alice, Carol and Dave see a stand-in playing West for Bob

    Scenario: A stand-in follows suit from its player's hand
      Given South has led the two of clubs to the first trick
      And West holds the nine of clubs and no other club
      And a stand-in is playing West for Bob
      When Bob's stand-in plays for West
      Then the nine of clubs is in the current trick

  Rule: A person who takes back their side sees their own current hand and the board, and no other hand

    Scenario: A person taking back their side sees their hand as it now stands
      Given a stand-in has played West's cards for Bob in the first two tricks
      And Bob is back online
      When Bob takes back his side
      Then Bob sees his own current hand, every cumulative score and whose turn it is
      And Bob sees no other player's hand

    Scenario: A person's own card is refused while a stand-in plays for them
      Given a stand-in is playing West for Bob and it is West's turn
      And Bob is back online
      When Bob plays the nine of clubs
      Then Bob is told a stand-in plays West for him until he takes back his side
      And the current trick is unchanged
