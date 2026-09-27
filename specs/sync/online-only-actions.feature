@domain:sync
Feature: Online-only actions
  When a person tries an online-only action offline, such as writing an
  announcement, they want to be told it needs a connection, not to have it
  happen later on its own, and to be able to do it once the connection is
  back.

  Background:
    Given Alice and Bob are in the shared space "Trip"
    And Alice's app is offline

  @goal:works-offline:6
  Scenario: An announcement written offline says it needs a connection
    When Alice writes the announcement "Fire drill" saying "at noon"
    Then Alice is told announcements need a connection
    And Alice does not see the note "Fire drill"

  @goal:works-offline:6
  Scenario: An announcement tried offline does not go out later
    Given Alice has tried to write the announcement "Fire drill" saying "at noon"
    When Alice's app comes back online
    Then Alice does not see the note "Fire drill"
    And Bob does not see the note "Fire drill"

  @goal:works-offline:6
  Scenario: An announcement can be written once the connection is back
    Given Alice has tried to write the announcement "Fire drill" saying "at noon"
    When Alice's app comes back online
    And Alice writes the announcement "Fire drill" saying "at noon"
    Then Bob sees the note "Fire drill" saying "at noon"
