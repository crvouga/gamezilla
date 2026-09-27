@domain:health
Feature: Live updates
  When something happens in a space, everyone in it wants to see it as it
  happens, so live updates must be ready in every environment, and nobody
  outside the team may take them over.

  Scenario: Live updates are ready to reach people
    Then live updates are ready to reach people

  Scenario: The app can send a live update
    Then the app can send a live update

  Scenario: People's apps receive this environment's live updates
    Then people's apps are pointed at this environment's live updates

  Scenario: Nobody can take over live updates with a well-known password
    Then nobody can take over live updates with the default password
    And nobody can take over live updates with a publicly known password
