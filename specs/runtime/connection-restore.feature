@domain:runtime
Feature: Connection restore
  Cutting a person off from the server and bringing the connection back leaves
  the app ready for anything that needs the server, such as signing in.

  @goal:works-offline:4
  Scenario: A guest can still sign in after the connection is cut and restored
    Given Alice is a guest
    When Alice loses the connection
    And the connection comes back
    And Alice signs in with Google
    Then Alice has a signed-in account
