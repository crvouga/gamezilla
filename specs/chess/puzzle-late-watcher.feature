@domain:chess
Feature: Arriving while a puzzle is under way
  When someone arrives mid-puzzle, or their connection drops while watching,
  they want the position the host is actually in, never an older one, so they
  can follow along. Guests can watch as well as friends.

  Rule: An arriving or returning watcher sees the host's current puzzle

    Background:
      Given Alice and Bob are guests
      And Alice is hosting a space
      And Alice is playing puzzles in their space

    Scenario: Someone who arrives mid-puzzle sees the host's current position
      Given Alice has played the next move of the solution
      When Bob joins the space from the link
      Then Bob is watching Alice's puzzle within 15 seconds
      And Alice's and Bob's boards agree within 15 seconds

    Scenario: A watcher who loses the connection sees the host's position once back online
      Given Bob has joined the space from the link and is watching Alice's puzzle
      And Bob is offline
      And Alice has played the next move of the solution
      When the connection comes back
      Then Alice's and Bob's boards agree within 20 seconds

    Scenario: Someone who arrives after the host moved on sees the new puzzle
      Given Alice has solved the puzzle
      And Alice has moved on to the next puzzle
      When Bob joins the space from the link
      Then Alice's and Bob's boards agree within 15 seconds
