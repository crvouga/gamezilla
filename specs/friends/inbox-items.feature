@domain:friends
Feature: Choose what the inbox shows
  When a person has a friend request in their inbox, they want to open it,
  mark it opened, set it aside, and look at one kind of item, so a missing
  connection never throws it away and the clock never does either.

  Background:
    Given Alice and Bob are signed in
    And Alice has sent Bob a friend request

  Rule: Opening an inbox item marks it opened only with a connection

    Scenario: Opening a friend request marks it opened
      Given Bob is viewing their inbox
      When Bob opens the friend request from Alice
      Then Bob's inbox shows the friend request from Alice as marked opened

    Scenario: Opening a friend request with no connection keeps it waiting
      Given Bob is offline
      When Bob opens the friend request from Alice
      Then Bob is told the connection is missing within 15 seconds
      And Bob's inbox shows the friend request from Alice as still waiting

  Rule: Marking the inbox read opens every waiting item, and only with a connection

    Scenario: Marking the inbox read opens the waiting friend request
      Given Bob is viewing their inbox
      When Bob marks the inbox read
      Then Bob's inbox shows the friend request from Alice as marked opened

    Scenario: Marking the inbox read with no connection changes nothing
      Given Bob is offline
      When Bob marks the inbox read
      Then Bob is told the connection is missing within 15 seconds
      And Bob's inbox shows the friend request from Alice as still waiting

  Rule: Archiving moves an item to the archived inbox, and the clock keeps every inbox item where it is
    No counter-example: a friend request that was never archived stays in the ordinary inbox, and a day passing keeps it there too.

    Scenario: Archiving a friend request shows it only in the archived inbox
      Given Bob is viewing their inbox
      When Bob archives the friend request from Alice
      Then Bob's inbox does not show a friend request from Alice
      And Bob's archived inbox shows the friend request from Alice

    Scenario: A day passing keeps an archived friend request where it was
      Given Bob has archived the friend request from Alice
      When a day passes
      Then Bob's inbox does not show a friend request from Alice
      And Bob's archived inbox shows the friend request from Alice

    Scenario: A day passing keeps a waiting friend request in the inbox
      When a day passes
      Then Bob's inbox shows a friend request from Alice within 15 seconds

    Scenario: Archiving with no connection keeps the friend request in the ordinary inbox
      Given Bob is offline
      When Bob archives the friend request from Alice
      Then Bob is told the connection is missing within 15 seconds
      And Bob's inbox shows a friend request from Alice within 15 seconds

  Rule: The inbox list shows one kind of item and does not change the items

    Scenario: The waiting inbox shows a friend request that still needs a choice
      Given Bob is viewing their inbox
      When Bob looks at the waiting inbox
      Then Bob's inbox shows a friend request from Alice within 15 seconds

    Scenario: The waiting inbox does not show a friend request that was archived
      Given Bob has archived the friend request from Alice
      When Bob looks at the waiting inbox
      Then Bob's inbox does not show a friend request from Alice
