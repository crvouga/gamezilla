@domain:sync
Feature: A long time offline
  When a person works offline for a long time, filing many notes in folders
  they make as they go, they want all of it to reach everyone once they are
  back online, each note in its folder, with nothing for them to do.

  Scenario: Many notes filed offline in new folders all reach others in their folders
    Given Alice and Bob use the app
    And Alice's app is offline
    And Alice has filed 30 notes offline, each in a new folder made just before it
    When Alice's app comes back online
    Then Bob sees all 30 notes, each in its folder
