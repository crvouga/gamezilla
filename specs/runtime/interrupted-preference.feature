@domain:runtime
Feature: An interrupted preference stays saved
  When a person is choosing how the app looks and something stops them, they
  want the preference they already saved to stay, so closing the app or
  running into trouble never throws that choice away.

  Rule: Closing the app before a preference is chosen keeps the saved preference
    No counter-example: a preference that was chosen is kept after the app closes, which Settings already promises.

    Scenario: Closing during the theme choices keeps the dark theme
      Given Alice has chosen the dark theme
      And Alice has opened the theme choices without choosing
      When Alice closes and reopens the app
      Then Alice's app is dark

  Rule: Running into trouble keeps the person's place and their saved preference
    No counter-example: running into trouble is not a command to move the person or to change a preference.

    Scenario: Trouble keeps the person where they were, with the dark theme
      Given Alice has chosen the dark theme
      And Alice has a place in the app and saved preferences
      When Alice runs into trouble
      Then Alice has the same place in the app and saved preferences
      And Alice's app is dark
