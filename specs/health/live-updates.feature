@domain:health
Feature: Live updates
  What happens in a space reaches everyone in it as it happens, and nobody
  outside the team can take over the live updates.

  Scenario: Live updates are ready to reach people
    Then live updates are ready to reach people

  Scenario: The app can send a live update
    Then the app can send a live update

  Scenario: People's apps receive this environment's live updates
    Then people's apps are pointed at this environment's live updates

  Scenario: Nobody can take over live updates with a well-known password
    Then nobody can take over live updates with the default admin password
    And nobody can take over live updates with a publicly known password
