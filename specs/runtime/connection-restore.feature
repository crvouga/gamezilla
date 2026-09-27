@domain:runtime
Feature: Connection restore
  A connection that drops and comes back leaves the app ready for anything
  that needs a connection, such as signing in.

  Scenario: A guest can sign in once the connection comes back
    Given Alice is a guest
    And Alice is offline
    And the connection has come back
    When Alice signs in with Google
    Then Alice has a signed-in account
