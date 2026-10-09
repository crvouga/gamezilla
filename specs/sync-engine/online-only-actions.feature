@domain:sync-engine
Feature: Online-only actions
  When a person writes an announcement offline, they want to know it needs
  a connection, so they can choose to write it once online and it never
  happens later on its own.

  Rule: An online-only action is refused offline and never happens later on its own

    Background:
      Given Alice and Bob are in the shared space "Trip"
      And Alice's app is offline

    Scenario: An announcement written offline says it needs a connection
      When Alice writes the announcement "Fire drill" saying "at noon"
      Then Alice is told announcements need a connection
      And Alice does not see the note "Fire drill"

    Scenario: An announcement tried offline does not go out later
      Given Alice has tried to write the announcement "Fire drill" saying "at noon"
      When Alice's app comes back online
      Then Alice does not see the note "Fire drill"
      And Bob does not see the note "Fire drill"

    Scenario: An announcement can be written once the connection is back
      Given Alice has tried to write the announcement "Fire drill" saying "at noon"
      When Alice's app comes back online
      And Alice writes the announcement "Fire drill" saying "at noon"
      Then Bob sees the note "Fire drill" saying "at noon"
