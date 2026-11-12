@domain:developer-tools
Feature: Investigate people in a test world
  When the team investigates what people experience together, the team wants
  to see their separate devices, so each person's choices and progress are clear.

  Rule: Choosing a device shows that person's app
    No counter-example: every available device has its own app; a missing choice falls back to an available device.

    Scenario: The team sees the selected person's device
      Given the testing tool has a test world with Alice's phone and Bob's phone
      When the team selects Bob's phone in the test world
      Then the team sees Bob's app
      And Alice's phone keeps Alice's place in the app

    Scenario: A missing device choice falls back to an available device
      Given the testing tool has a test world with Alice's phone only
      When the team opens the test world's address for Bob's phone
      Then the team sees Alice's app
