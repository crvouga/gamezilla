@domain:journeys
Feature: Joining from a link, and opening with no connection
  When a person has a space link, or the app has been opened and the device is
  offline, they want that still to work, so a link joins the space and the app
  still opens.

  Rule: Anyone with a space link can join that open space

    Scenario: A guest joins an open space from its link
      Given a person is hosting a space
      When a guest joins the space from the link
      Then the guest is in the space

    Scenario: A guest cannot join from a link to a space that has ended
      Given a person has ended the space
      When a guest joins the space from the link
      Then the guest is told the space has ended

  Rule: After the app has been opened once, it opens with no connection
    No counter-example: a fresh device has never opened the app, so this rule is not about it.

    Scenario: The app opens onto the tabs with no connection
      Given the app has been opened on a fresh device
      And the device is offline
      When the app reopens
      Then the app gets past its opening screen onto the tabs
