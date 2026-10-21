@domain:friends
Feature: People search needs a connection
  When a person is offline and tries to search for someone they do not know,
  they want the app to say plainly that search needs a connection, so they
  know why they cannot find that person yet.

  Rule: People search needs a connection to find a stranger

    Scenario: Searching while connected finds another person
      Given Alice and Bob are signed in
      When Alice searches for "bob"
      Then Alice's search shows Bob

    @regression:people-search-offline-hangs
    Scenario: Searching for people without a connection says it needs one
      Given Alice and Bob are signed in
      And Alice is offline
      When Alice searches for "bob"
      Then Alice is told search needs a connection within 15 seconds

  Rule: Without a connection, people search still finds friends
    No counter-example: a stranger is the first rule's refusal.

    @regression:offline-search-hides-known-people
    Scenario: Searching for a friend without a connection still finds them
      Given Alice and Bob are friends
      And Alice is offline
      When Alice searches for "bob"
      Then Alice's search shows Bob
