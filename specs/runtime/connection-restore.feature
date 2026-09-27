@domain:runtime
Feature: Connection restore
  When a person was cut off and the connection comes back, they want
  everything that needs a connection, such as signing in, to work again at
  once, so being cut off costs them nothing.

  Scenario: A guest can sign in once the connection comes back
    Given Alice is a guest
    And Alice is offline
    And the connection has come back
    When Alice signs in with Google
    Then Alice has a signed-in account
