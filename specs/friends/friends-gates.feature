@domain:friends @goal:social:1
Feature: Friends are for people with an account
  A guest who reaches for friends is asked to sign in, right there; a signed-in
  person with no friends yet is pointed at people search.

  Scenario: A guest searching for people is asked to sign in
    Given Alice is a guest
    When Alice searches for "bob"
    Then Alice is told search needs an account
    When Alice follows the sign-in prompt from search
    Then Alice is asked to sign in

  Scenario: A guest's friends row asks them to sign in
    Given Alice is a guest
    Then Alice's friend count is 0
    When Alice opens their friends list
    Then Alice is asked to sign in within 5 seconds

  Scenario: With no friends yet, the list says so and Find friends opens search
    Given Alice is signed in
    When Alice opens their friends list
    Then Alice is told they have no friends yet within 5 seconds
    When Alice follows the find-friends prompt
    Then Alice can search for people
