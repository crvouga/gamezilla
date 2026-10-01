@domain:runtime @synthetic
Feature: Serving people
  When people use the app, they want it to answer them right now, so it
  needs everything in place and what people saved ready for the app as it is
  now.

  Rule: The app answers people, with everything it needs already in place
    No counter-example: the team checks this from outside, and nothing a person does is refused.

    Scenario: The app answers people
      Then the app answers people

    Scenario: Everything the app needs to answer people is ready
      Then everything the app needs to answer people is ready

    Scenario: What people saved is ready for the app as it is now
      Then what people saved is ready for the app as it is now

    Scenario: The app has every setting it needs
      Then the app is given every setting it needs
