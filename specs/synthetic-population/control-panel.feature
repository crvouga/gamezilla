@domain:synthetic-population
Feature: Control Synthetic Users from their control panels
  When Synthetic Users need attention, an authorized person wants to pause,
  resume or restart one of them or every one at once, so the
  Synthetic Population keeps behaving well while people play.

  Rule: Only a Synthetic User has a control panel

    Background:
      Given Alice is authorized to control the Synthetic Population

    Scenario: An authorized person is offered a Synthetic User's control panel
      Given the Synthetic User "Cedar" is available
      When Alice opens the Bot Observatory
      Then Alice is offered the control panel of "Cedar"

    Scenario: A person online now never has a control panel
      Given Bob is using the app now
      When Alice opens the Bot Observatory
      Then Alice is not offered a control panel for Bob

  Rule: Pausing every Synthetic User at once stops each one starting a new activity

    Scenario: Pausing every Synthetic User stops them all starting new activities
      Given Alice is authorized to control the Synthetic Population
      And the Synthetic Users "Cedar" and "Maple" are available
      When Alice pauses every Synthetic User
      Then "Cedar" starts no new activity
      And "Maple" starts no new activity

    Scenario: A person with observation permission cannot pause every Synthetic User
      Given Alice is authorized to view the Bot Observatory
      And the Synthetic User "Cedar" is available
      When Alice pauses every Synthetic User
      Then Alice is told that permission is required
      And "Cedar" remains available

  Rule: Resuming every Synthetic User at once lets each one start activities again

    Scenario: Resuming every Synthetic User makes them all available again
      Given Alice is authorized to control the Synthetic Population
      And the Synthetic Users "Cedar" and "Maple" are paused
      When Alice resumes every Synthetic User
      Then the Synthetic Users "Cedar" and "Maple" are available within 30 seconds

    Scenario: A person with observation permission cannot resume every Synthetic User
      Given Alice is authorized to view the Bot Observatory
      And the Synthetic User "Cedar" is paused
      When Alice resumes every Synthetic User
      Then Alice is told that permission is required
      And "Cedar" is still paused

  Rule: Resuming a paused Synthetic User lets it start activities again

    Scenario: Resuming a paused Synthetic User makes it available again
      Given Alice is authorized to control the Synthetic Population
      And the Synthetic User "Cedar" is paused
      When Alice resumes the Synthetic User "Cedar"
      Then the Synthetic User "Cedar" is available within 30 seconds

    Scenario: A person with observation permission cannot resume a Synthetic User
      Given Alice is authorized to view the Bot Observatory
      And the Synthetic User "Cedar" is paused
      When Alice resumes the Synthetic User "Cedar"
      Then Alice is told that permission is required
      And "Cedar" is still paused

  Rule: Restarting a Synthetic User keeps its account, its persona and its ongoing game

    Scenario: A restarted Synthetic User carries on with its ongoing game
      Given Alice is authorized to control the Synthetic Population
      And the Synthetic User "Cedar" has an ongoing "chess" game
      When Alice restarts the Synthetic User "Cedar"
      Then the Synthetic User "Cedar" keeps its persona
      And the Synthetic User "Cedar" continues its same multiplayer game

    Scenario: A person with observation permission cannot restart a Synthetic User
      Given Alice is authorized to view the Bot Observatory
      And the Synthetic User "Cedar" has an ongoing "chess" game
      When Alice restarts the Synthetic User "Cedar"
      Then Alice is told that permission is required
      And the Synthetic User "Cedar" continues its same multiplayer game
