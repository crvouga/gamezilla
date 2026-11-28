@domain:journeys
Feature: Using the app on a fresh device
  When a person opens the app on a fresh device, they want to use
  the tabs at once so they can choose where to go.

  Rule: Settings opens from the tabs in under one second without an opening screen
    No counter-example: every opening on this device must meet the same deadline.

    Scenario: A person reaches Settings immediately on a fresh device
      When they open the app and choose Settings
      Then they can open Settings in under one second without seeing an opening screen
