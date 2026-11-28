@domain:journeys
Feature: Joining from a link, and reopening after a lost connection
  When a person has a space link, or the app has been opened and the device is
  offline, they want to join the space or reopen the app once connected again.

  Rule: Anyone with a space link can join that open space

    Scenario: A guest joins an open space from its link
      Given a person is hosting a space
      When a guest joins the space from the link
      Then the guest is in the space

    Scenario: A guest cannot join from a link to a space that has ended
      Given a person has ended the space
      When a guest joins the space from the link
      Then the guest is told the space has ended

  Rule: The web app opens again when the connection returns
    No counter-example: a fresh device has never opened the app, so this rule is not about it.

    Scenario: The app reopens onto the tabs after the connection returns
      Given the app has been opened on a fresh device
      And the device is offline
      When the connection returns and they reopen the app
      Then the app gets past its opening screen onto the tabs
