@domain:games
Feature: Blocking in custom games
  When someone has blocked another person, both want to stay out of a custom game together, so a block works in custom games as it does when finding an opponent.

  Rule: The creator cannot invite someone when either of them has blocked the other

    Background:
      Given Alice is setting up a custom game
      And Bob is in Alice's space

    Scenario: A block with someone else does not stop an invitation
      Given Alice has blocked Carol
      When Alice invites Bob to the second side
      Then the second side is reserved for Bob

    Scenario: The creator cannot invite someone she blocked
      Given Alice has blocked Bob
      When Alice invites Bob to the second side
      Then Alice is told Bob cannot be invited
      And the second side is open

    Scenario: The creator is not told that the person she invites blocked her
      Given Bob has blocked Alice
      When Alice invites Bob to the second side
      Then Alice is told Bob cannot be invited
      And the second side is open

  Rule: Someone with a block between them and the creator cannot claim an open side of the creator's custom game

    Background:
      Given Alice is setting up a custom game
      And Bob is in Alice's space

    Scenario: A block with someone else does not stop a claim
      Given Bob has blocked Carol
      When Bob claims the second side
      Then the second side is Bob

    Scenario: A blocked person cannot claim the open side
      Given Alice has blocked Bob
      When Bob claims the second side
      Then Bob is told that side is not available to him
      And Bob is not told Alice blocked him

  Rule: A block after the custom game has started does not end it
    No counter-example: blocking changes nothing about a custom game under way, as with a matched game.

    Scenario: Blocking the other participant keeps the custom game under way
      Given Bob is signed in
      And Bob's username is @bob
      And Alice and Bob have a custom game under way
      When Alice blocks Bob
      Then the custom game remains under way
      And neither person has won the custom game
