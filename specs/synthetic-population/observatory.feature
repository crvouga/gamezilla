@domain:synthetic-population
Feature: Observe and control the Synthetic Population
  When automated opponents are available, an authorized person wants to
  observe their activity and choose how many are available, so people can
  find opponents without mistaking them for people.

  Rule: Only authorized people can use the Bot Observatory

    @regression:stack-fixtures-publish-to-in-process-broker
    Scenario: An authorized person sees the desired synthetic population
      Given Alice is authorized to view the Bot Observatory
      And the desired synthetic population is 4
      When Alice opens the Bot Observatory
      Then Alice sees a desired synthetic population of 4

    @regression:synthetic-population-denial-removes-shell
    Scenario: An ordinary person cannot inspect Synthetic Users
      Given Bob is not authorized to view the Bot Observatory
      When Bob opens the Bot Observatory
      Then Bob is told that permission is required
      And Bob sees no Synthetic User activity

  Rule: Changing the desired synthetic population requires permission

    @regression:synthetic-population-config-save-stays-disabled
    Scenario: An authorized person changes the desired synthetic population
      Given Alice is authorized to configure the Synthetic Population
      When Alice changes the desired synthetic population to 6
      Then Alice sees a desired synthetic population of 6

    Scenario: A person with observation permission cannot change the desired synthetic population
      Given Alice is authorized to view the Bot Observatory
      And the desired synthetic population is 4
      When Alice changes the desired synthetic population to 6
      Then Alice is told that permission is required
      And the desired synthetic population remains 4

  Rule: Pausing preserves an ongoing game

    @regression:synthetic-population-chess-clicks-submit-no-move
    Scenario: A paused Synthetic User finishes its ongoing game
      Given Alice is authorized to control the Synthetic Population
      And the Synthetic User "Cedar" has an ongoing game
      When Alice pauses the Synthetic User "Cedar"
      Then "Cedar" can finish its ongoing game
      And "Cedar" starts no new activity

    Scenario: A person with observation permission cannot pause a Synthetic User
      Given Alice is authorized to view the Bot Observatory
      And the Synthetic User "Cedar" is available
      When Alice pauses the Synthetic User "Cedar"
      Then Alice is told that permission is required
      And "Cedar" remains available
