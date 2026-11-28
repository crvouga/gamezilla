@domain:journeys
Feature: Using the app on a device that has opened the app before
  When a person opens the app on a device that has opened the app before, they want to use
  the tabs at once so they can choose where to go.

  Rule: Settings opens from the tabs in under one second without an opening screen
    No counter-example: every opening on this device must meet the same deadline.

    Scenario: A person reaches Settings immediately on a device that has opened the app before
      Given the app has been opened on a fresh device
      When the app reopens
      Then they can open Settings in under one second without seeing an opening screen
