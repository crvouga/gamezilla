@domain:runtime @goal:works-offline:1
Feature: The app opens without a connection
  Once the app has been opened, it opens and works with no connection, so a
  person on a plane or in a tunnel is never locked out.

  Scenario: The app opens without a connection after its first opening
    Given Alice has opened the app before
    And Alice is offline
    When Alice closes and reopens the app
    Then Alice sees the tabs
    And Alice is on Spaces

  Scenario: Settings open without a connection
    Given Alice has opened the app before
    And Alice is offline
    When Alice opens Settings
    Then Alice is on Settings
