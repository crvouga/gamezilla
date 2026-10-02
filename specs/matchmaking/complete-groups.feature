@domain:matchmaking
Feature: Complete groups of people who accept one another
  When people want a match for a chosen number of people, they want that
  whole group to accept one another, so a match is neither incomplete nor
  made larger than anyone asked for.

  Rule: Every person in a group accepts every other person in it

    Scenario: Three people receive one match when all accept each other
      Given Alice, Bob and Carol are waiting for a group of 3 within each other's ranges
      When matchmaking pairs people up
      Then Alice, Bob and Carol have the same match

    Scenario: Alice accepting Bob and Carol does not mean Bob accepts Carol
      Given Alice, Bob and Carol are waiting for a group of 3
      And Alice accepts Bob and Carol but Bob and Carol do not accept each other
      When matchmaking pairs people up
      Then Alice, Bob and Carol are still waiting

  Rule: A match has exactly the number of people each person asked for

    Scenario: Four compatible waits complete a requested group of four
      Given Alice, Bob, Carol and Dave are waiting for a group of 4 within each other's ranges
      When matchmaking pairs people up
      Then Alice, Bob, Carol and Dave have the same match

    Scenario: Two people cannot receive a partial group of three
      Given Alice and Bob are waiting for a group of 3 within each other's ranges
      When matchmaking pairs people up
      Then Alice and Bob are still waiting

    Scenario: Different group sizes cannot be paired
      Given Alice is waiting for a group of 2
      And Bob is waiting for a group of 3
      When matchmaking pairs people up
      Then Alice and Bob are still waiting
