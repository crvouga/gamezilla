@domain:runtime
Feature: An interrupted preference stays saved
  When a person is choosing whether sounds play and something stops them, they
  want the preference they already saved to stay, so closing the app or
  running into trouble never throws that choice away.

  Rule: Closing the app before a preference is chosen keeps the saved preference
    No counter-example: a preference that was chosen is kept after the app closes, which Settings already promises.

    Scenario: Closing Sound without changing it keeps sounds off
      Given Alice has turned sounds off
      And Alice has opened Sound without changing it
      When Alice closes and reopens the app
      Then Alice's sounds are off

  Rule: Running into trouble keeps the person's place and their saved preference
    No counter-example: running into trouble is not a command to move the person or to change a preference.

    Scenario: Trouble keeps the person where they were, with sounds off
      Given Alice has turned sounds off
      And Alice has a place in the app and saved preferences
      When Alice runs into trouble
      Then Alice has the same place in the app and saved preferences
      And Alice's sounds are off
