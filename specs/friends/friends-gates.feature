@domain:friends
Feature: Friends are for people with an account
  A guest who reaches for friends is asked to sign in, right there; a signed-in
  person with no friends yet is pointed at people search.

  Rule: A guest is asked to sign in

    Scenario: A guest's search says it needs an account
      Given Alice is a guest
      When Alice searches for "bob"
      Then Alice is told search needs an account

    Scenario: A guest can sign in straight from search
      Given Alice is a guest
      And Alice has searched for "bob"
      When Alice chooses to sign in from search
      Then Alice is asked to sign in

    Scenario: A guest opening their friends list is asked to sign in
      Given Alice is a guest
      When Alice opens their friends list
      Then Alice is asked to sign in within 5 seconds

  Rule: An empty friends list points at people search

    Scenario: An empty friends list says so
      Given Alice is signed in
      When Alice opens their friends list
      Then Alice is told they have no friends yet within 5 seconds

    Scenario: An empty friends list leads to people search
      Given Alice is signed in
      And Alice is viewing their empty friends list
      When Alice chooses to find friends
      Then Alice can search for people
