@domain:games
Feature: The daily matched game allowance for guests
  When a guest wants another opponent, they want to play freely and know
  before the limit how to keep playing, so the limit never costs them a game
  they began. The limit is one allowance for every game offering matched
  games, so its rule about another game applies when at least two games offer
  them.

  Rule: A guest begins at most 10 matched games a day

    Scenario: A guest's tenth matched game of the day can still be sought
      Given Alice is a guest who has started 9 matched games today
      When Alice seeks an opponent for the game
      Then Alice can stop seeking an opponent

    Scenario: A guest past today's allowance is invited to sign in
      Given Alice is a guest who has started 10 matched games today
      When Alice seeks an opponent for the game
      Then Alice is told no new matched game can start because today's allowance is used
      And Alice is invited to sign in
      And Alice is not waiting for an opponent

  Rule: Matched games of every game count toward the same daily allowance

    Scenario: A guest's tenth matched game of the day can be sought after matched games of another game
      Given Alice is a guest who has started 9 matched games of another game today
      When Alice seeks an opponent for the game
      Then Alice can stop seeking an opponent

    Scenario: A guest who used today's allowance in another game cannot seek an opponent for the game
      Given Alice is a guest who has started 10 matched games of another game today
      When Alice seeks an opponent for the game
      Then Alice is told no new matched game can start because today's allowance is used
      And Alice is not waiting for an opponent

  Rule: Only matched games that got under way use the allowance
    No counter-example: a matched game under way is counted, which is the first rule's refusal.

    Scenario: A matched game aborted before it was under way uses none of the allowance
      Given Alice is a guest who has started 9 matched games today
      And Alice's matched game with Bob was aborted before it was under way
      When Alice seeks an opponent for the game
      Then Alice can stop seeking an opponent

    Scenario: A search that was stopped uses none of the allowance
      Given Alice is a guest who has started 9 matched games today
      And Alice has stopped seeking an opponent
      When Alice seeks an opponent for the game
      Then Alice can stop seeking an opponent

  Rule: Reaching the allowance never interrupts a matched game
    No counter-example: the allowance only refuses seeking an opponent, never a matched game already begun.

    Scenario: A guest's tenth matched game of the day goes on
      Given Alice is a guest who has started 9 matched games today
      And Alice has an unfinished matched game with Bob
      When Alice opens finding an opponent
      Then Alice keeps her matched game with Bob

  Rule: A guest is shown how many matched games remain today only when 3 or fewer do

    Scenario: A guest with 3 matched games left today is shown them
      Given Alice is a guest who has started 7 matched games today
      When Alice opens finding an opponent
      Then Alice can read that 3 matched games remain today

    Scenario: A guest with 4 matched games left today is not shown a count
      Given Alice is a guest who has started 6 matched games today
      When Alice opens finding an opponent
      Then Alice is not shown how many matched games remain today

  Rule: A new day brings a fresh allowance
    No counter-example: matched games started today are the first rule's refusal.

    Scenario: Matched games started before today do not count
      Given Alice is a guest who started 10 matched games before today
      When Alice seeks an opponent for the game
      Then Alice can stop seeking an opponent

  Rule: Accounts have no daily matched game limit
    No counter-example: a guest past today's allowance is the first rule's refusal.

    Scenario: A free account seeks an opponent after many matched games today
      Given Alice has a free account that started 10 matched games today
      When Alice seeks an opponent for the game
      Then Alice can stop seeking an opponent
